/**
 * @packageDocumentation
 *
 * ジョブキュー画面の「配送先」タブ用に、配送先サーバの状態の概要と「いま問題のあるサーバ」の一覧を返す API。
 *
 * @remarks
 * - 一時停止（ブレーカー）の状態は queue ワーカーのメモリにしか無いので、queue ワーカーが Redis に書いた
 *   スナップショット（{@link readHealthSnapshot}）を読む。
 * - 「問題のあるサーバ」は、一時停止中・停止中（手動を除く）・遅延中のジョブがある・不通の記録があるサーバ。
 * - 遅延中のジョブ数は deliver キューの delayed を全件読んで数える。重いので、件数の多い順に上位だけ返す。
 * - 直近 24 時間の失敗率は、サーバ別チャート（`__chart__instance` の時間単位）から求める。
 *
 * @see plans/instance-delivery-health-plan.md 設計方針 7
 * @internal
 */
import { In, IsNull, Not } from "typeorm";
import define from "../../../define.js";
import { db } from "@/db/postgre.js";
import { Instances } from "@/models/index.js";
import { deliverQueue } from "@/queue/queues.js";
import { toPuny } from "@/misc/convert-host.js";
import { readHealthSnapshot } from "@/services/instance-health/index.js";

/** 一覧に出すサーバの最大数 */
const MAX_PROBLEM_HOSTS = 200;

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "read:admin:federation",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			counts: { type: "object", optional: false, nullable: false },
			breaker: { type: "object", optional: false, nullable: true },
			hosts: { type: "array", optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

/**
 * 「問題のあるサーバ」1 行分。
 *
 * @internal
 */
type ProblemHost = {
	host: string;
	/** 長期の状態（instance 行が無ければ null） */
	suspensionState: string | null;
	/** 一時停止中か */
	circuitOpen: boolean;
	/** いつから（一時停止・停止・不通のうち、いちばん古い時刻） */
	since: string | null;
	/** 最後のエラー（一時停止中なら分類つきの短い説明、停止中なら理由） */
	lastError: string | null;
	/** 次に確かめる時刻（一時停止中・自動停止中） */
	nextCheckAt: string | null;
	/** 遅延中のジョブ数 */
	delayedJobs: number;
	/** 直近 24 時間の配送の成功・失敗数 */
	succeeded24h: number;
	failed24h: number;
};

export default define(meta, paramDef, async () => {
	//#region 状態ごとの件数
	const stateRows: { state: string; count: string }[] = await Instances.createQueryBuilder("i")
		.select('i."suspensionState"', "state")
		.addSelect("COUNT(*)", "count")
		.groupBy('i."suspensionState"')
		.getRawMany();
	const notResponding = await Instances.countBy({
		notRespondingSince: Not(IsNull()),
		suspensionState: "none",
	});
	const counts: Record<string, number> = {
		manuallySuspended: 0,
		goneSuspended: 0,
		autoSuspendedForNotResponding: 0,
		notResponding,
	};
	for (const r of stateRows) {
		if (r.state !== "none") counts[r.state] = Number(r.count);
	}
	//#endregion

	//#region 一時停止（queue ワーカーのスナップショット）
	const snapshot = await readHealthSnapshot();
	counts.circuitOpen = snapshot?.openCircuits.length ?? 0;
	//#endregion

	//#region 遅延中のジョブ（ホスト別）
	const delayedByHost = new Map<string, number>();
	for (const job of await deliverQueue.getDelayed()) {
		try {
			const host = toPuny(new URL(job.data.to).host);
			delayedByHost.set(host, (delayedByHost.get(host) ?? 0) + 1);
		} catch {
			// 壊れたジョブは数えない
		}
	}
	//#endregion

	//#region 対象のサーバを集める
	const problemRows = await Instances.find({
		select: [
			"host",
			"suspensionState",
			"suspendedAt",
			"suspendedReason",
			"notRespondingSince",
			"nextProbeAt",
		],
		where: [
			{ suspensionState: In(["goneSuspended", "autoSuspendedForNotResponding"]) },
			{ notRespondingSince: Not(IsNull()), suspensionState: "none" },
		],
	});

	const hosts = new Map<string, ProblemHost>();
	const ensure = (host: string): ProblemHost => {
		let h = hosts.get(host);
		if (!h) {
			h = {
				host,
				suspensionState: null,
				circuitOpen: false,
				since: null,
				lastError: null,
				nextCheckAt: null,
				delayedJobs: 0,
				succeeded24h: 0,
				failed24h: 0,
			};
			hosts.set(host, h);
		}
		return h;
	};
	const earlier = (a: string | null, b: Date | number | null) => {
		if (b == null) return a;
		const iso = new Date(b).toISOString();
		return a == null || iso < a ? iso : a;
	};

	for (const r of problemRows) {
		const h = ensure(r.host);
		h.suspensionState = r.suspensionState;
		h.since = earlier(earlier(h.since, r.suspendedAt), r.notRespondingSince);
		if (r.suspensionState !== "none") h.lastError = r.suspendedReason;
		if (r.suspensionState === "autoSuspendedForNotResponding" && r.nextProbeAt) {
			h.nextCheckAt = r.nextProbeAt.toISOString();
		}
	}
	for (const c of snapshot?.openCircuits ?? []) {
		const h = ensure(c.host);
		h.circuitOpen = true;
		h.since = earlier(h.since, c.openedAt);
		h.lastError = c.lastError;
		h.nextCheckAt = new Date(c.nextProbeAt).toISOString();
	}
	for (const [host, n] of delayedByHost) ensure(host).delayedJobs = n;
	//#endregion

	//#region 並べ替えて上位に絞り、24 時間の成功・失敗数を足す
	const list = [...hosts.values()]
		.sort(
			(a, b) =>
				Number(b.circuitOpen) - Number(a.circuitOpen) ||
				b.delayedJobs - a.delayedJobs ||
				(a.since ?? "").localeCompare(b.since ?? ""),
		)
		.slice(0, MAX_PROBLEM_HOSTS);

	if (list.length > 0) {
		// 時間単位のチャートの date は秒（UTC の時の区切り）
		const from = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
		const rows: { group: string; failed: string; succeeded: string }[] = await db.query(
			`SELECT "group", SUM("___requests_failed") AS failed, SUM("___requests_succeeded") AS succeeded
			   FROM "__chart__instance"
			  WHERE "date" >= $1 AND "group" = ANY($2)
			  GROUP BY "group"`,
			[from, list.map((h) => h.host)],
		);
		for (const r of rows) {
			const h = hosts.get(r.group);
			if (!h) continue;
			h.failed24h = Number(r.failed);
			h.succeeded24h = Number(r.succeeded);
		}
	}
	//#endregion

	return {
		counts,
		breaker: snapshot
			? {
					updatedAt: new Date(snapshot.updatedAt).toISOString(),
					startedAt: new Date(snapshot.startedAt).toISOString(),
					skipped24h: snapshot.skipped24h,
					opened24h: snapshot.opened24h,
					adaptiveDelayMs: snapshot.adaptiveDelayMs,
			  }
			: null,
		hosts: list,
	};
});
