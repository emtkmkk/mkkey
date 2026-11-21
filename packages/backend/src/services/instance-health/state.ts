/**
 * @packageDocumentation
 *
 * 配送先サーバの「長期の状態」（不通になった時刻と、配信の停止）を書き換える唯一の場所。
 *
 * @remarks
 * - **役割**: 配送・受信・生存確認・管理操作から「できごと」を受け取り、必要なときだけ DB を書き換える。
 *   停止状態を変えるときは、同じトランザクションで履歴（`instance_health_log`）にも 1 行書く。
 *   履歴を書かずに停止状態を変える経路を作らないこと。
 * - 状態の移り変わり（計画 `plans/instance-delivery-health-plan.md` 設計方針 2・4）:
 *   - 不通（`hostDown` の失敗）が始まったら `notRespondingSince` を記録する。応答があれば消す。
 *   - 不通が {@link AUTO_SUSPEND_AFTER_MS}（3 日、決定事項 Q4）続いたら自動停止。
 *   - 自動停止は、生存確認（probe-instances）か相手からの受信で解除する。
 *   - 閉鎖停止（サーバ自体が 410）は確認しない（Q7）。相手からの受信でだけ解除する（Q11）。
 *   - **手動停止は自動では絶対に解除しない。** 自動の停止で手動停止を上書きもしない。
 * - 書き込みは「変わったとき」だけ。判断に使う値はホストごとにメモリに持ち（{@link HEALTH_CACHE_TTL_MS}）、
 *   変化は内部イベント `instanceSuspensionChanged` で全プロセスに知らせる。
 * - 同時に別の経路が状態を変えても壊れないよう、停止状態の更新は「今の状態が想定どおりなら」の条件つきで行う。
 *
 * @internal
 */
import cluster from "node:cluster";
import { IsNull } from "typeorm";
import { db } from "@/db/postgre.js";
import { subscriber } from "@/db/redis.js";
import { genId } from "@/misc/gen-id.js";
import { Instances, InstanceHealthLogs } from "@/models/index.js";
import {
	Instance,
	type InstanceSuspensionState,
} from "@/models/entities/instance.js";
import {
	InstanceHealthLog,
	type InstanceHealthEvent,
	type InstanceHealthSource,
} from "@/models/entities/instance-health-log.js";
import type { User } from "@/models/entities/user.js";
import { publishInternalEvent } from "@/services/stream.js";
import Logger from "@/services/logger.js";
import { applySuspensionChange } from "./suspended-hosts.js";
import { deliverCircuit } from "./deliver-circuit.js";
import type { CircuitEvent } from "./circuit.js";

const logger = new Logger("instance-health", "yellow");

//#region 定数

/** 不通がこれだけ続いたら自動停止する（決定事項 Q4） */
export const AUTO_SUSPEND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

/** 自動停止後、最初の生存確認までの時間 */
export const FIRST_PROBE_DELAY_MS = 60 * 60 * 1000;

/** 生存確認の間隔の上限 */
export const MAX_PROBE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** ホストごとの状態のメモリ保持時間。これを過ぎたら DB から読み直す */
const HEALTH_CACHE_TTL_MS = 10 * 60 * 1000;

/** メモリに持つホスト数の上限 */
const HEALTH_CACHE_MAX = 20000;

/** 統計（最終送受信日時など）の書き込みの最短間隔。ホストごと */
const STATS_WRITE_INTERVAL_MS = 60 * 1000;

/** 理由の最大長（DB の列は 512） */
const REASON_MAX_LENGTH = 512;

//#endregion 定数

//#region 型

/**
 * 判断に使う、ホスト 1 件分の状態。
 *
 * @internal
 */
type HostHealth = {
	id: Instance["id"];
	host: string;
	suspensionState: InstanceSuspensionState;
	notRespondingSince: Date | null;
	/** メモリに読んだ時刻 */
	loadedAt: number;
};

/**
 * 停止状態を変えるときの指定。
 *
 * @internal
 */
type TransitionOptions = {
	event: InstanceHealthEvent;
	source: InstanceHealthSource;
	reason?: string | null;
	actorId?: User["id"] | null;
	detail?: Record<string, any>;
	/** instance 行に一緒に書く値 */
	extra?: Partial<Instance>;
};

//#endregion 型

//#region フィールド

/** ホスト → 状態。可変 */
const healthCache = new Map<string, HostHealth>();

/** `種類:ホスト` → 統計を最後に書いた時刻。可変 */
const lastStatsWriteAt = new Map<string, number>();

//#endregion フィールド

//#region 公開関数

/**
 * 「確実」な不通（{@link ./classify.ts} の `hostDown`）を記録する。
 *
 * @remarks
 * 初めての不通なら時刻を記録し、{@link AUTO_SUSPEND_AFTER_MS} 続いていれば自動停止する。
 * 呼ばれるのは、配送の失敗（ブレーカーが開くまで）と、一時停止中の復帰の確認の失敗（最長 1 時間おき）。
 *
 * @param host - ホスト（punycode）
 * @param info - 失敗の内容
 * @param info.source - きっかけ
 * @param info.label - 失敗の短い説明（例: `ECONNREFUSED`）
 * @param info.statusCode - HTTP ステータス（あれば）
 * @internal
 */
export async function noteHostDown(
	host: string,
	info: { source: "deliver" | "probe"; label: string; statusCode?: number },
): Promise<void> {
	const h = await getHealth(host);
	if (h == null) return;

	const now = new Date();

	if (h.notRespondingSince == null) {
		await Instances.update(
			{ id: h.id, notRespondingSince: IsNull() },
			{ notRespondingSince: now, isNotResponding: true },
		);
		h.notRespondingSince = now;
		return;
	}

	if (
		h.suspensionState === "none" &&
		now.getTime() - h.notRespondingSince.getTime() >= AUTO_SUSPEND_AFTER_MS
	) {
		await transition(h, "autoSuspendedForNotResponding", {
			event: "autoSuspended",
			source: info.source,
			reason: `${formatDuration(now.getTime() - h.notRespondingSince.getTime())}不通（最後のエラー: ${info.label}）`,
			detail: {
				notRespondingSince: h.notRespondingSince.toISOString(),
				lastError: info.label,
				statusCode: info.statusCode,
			},
			extra: {
				nextProbeAt: new Date(now.getTime() + FIRST_PROBE_DELAY_MS),
				probeFailures: 0,
			},
		});
	}
}

/**
 * 相手のアプリが応答したことを記録する。
 *
 * @remarks
 * - 不通の記録があれば消す。
 * - 受信（署名の検証済み）なら、自動停止と閉鎖停止を解除する（Q11）。
 * - 生存確認の成功なら、自動停止を解除する。閉鎖停止は解除しない（そもそも確認しない、Q7）。
 * - 配送の成功・4xx は、停止の解除には使わない（停止中は配送しないので、来ることも無い）。
 *
 * @param host - ホスト（punycode）
 * @param source - きっかけ
 * @param detail - 履歴に残す根拠（受信なら Activity の種類と id、確認ならステータス）
 * @internal
 */
export async function noteHostAlive(
	host: string,
	source: "deliver" | "inbox" | "probe",
	detail: Record<string, unknown> = {},
): Promise<void> {
	const h = await getHealth(host);
	if (h == null) return;

	if (h.notRespondingSince != null) {
		await Instances.update(
			{ id: h.id },
			{ notRespondingSince: null, isNotResponding: false },
		);
		h.notRespondingSince = null;
	}

	const unsuspend =
		(source === "inbox" &&
			(h.suspensionState === "autoSuspendedForNotResponding" ||
				h.suspensionState === "goneSuspended")) ||
		(source === "probe" &&
			h.suspensionState === "autoSuspendedForNotResponding");
	if (!unsuspend) return;

	await transition(h, "none", {
		event: source === "inbox" ? "unsuspendedByInbox" : "unsuspendedByProbe",
		source,
		detail,
		extra: { nextProbeAt: null, probeFailures: 0 },
	});
}

/**
 * サーバ自体の閉鎖（410）を記録し、閉鎖停止にする。
 *
 * @remarks
 * 手動停止は上書きしない。自動停止は「閉鎖」の方が確かな情報なので上書きする。
 *
 * @param host - ホスト（punycode）
 * @param source - きっかけ
 * @param detail - 410 を返した URL など
 * @internal
 */
export async function markGone(
	host: string,
	source: "deliver" | "probe",
	detail: { url: string; via: "sharedInbox" | "nodeinfo" },
): Promise<void> {
	const h = await getHealth(host);
	if (h == null) return;
	if (
		h.suspensionState === "goneSuspended" ||
		h.suspensionState === "manuallySuspended"
	) {
		return;
	}

	await transition(h, "goneSuspended", {
		event: "gone",
		source,
		reason: `${detail.via === "sharedInbox" ? "shared inbox" : "nodeinfo"} が 410 を返した`,
		detail,
		extra: { nextProbeAt: null, probeFailures: 0 },
	});
}

/**
 * 管理者が停止・解除する。
 *
 * @remarks
 * 停止はどの状態からでも「手動停止」にする。解除はどの停止からでも「停止していない」に戻す。
 * モデレーションログは呼び出し側（API）で残す。
 *
 * @param host - ホスト（punycode）
 * @param suspend - 停止するなら true、解除するなら false
 * @param actorId - 操作した管理者
 * @param reason - 管理者のメモ
 * @returns 変化前の状態。変化しなかった・ホストが無ければ null
 * @internal
 */
export async function setManualSuspension(
	host: string,
	suspend: boolean,
	actorId: User["id"],
	reason: string | null,
): Promise<InstanceSuspensionState | null> {
	// 管理操作は必ず最新の値で判断する
	healthCache.delete(host);
	const h = await getHealth(host);
	if (h == null) return null;

	const from = h.suspensionState;
	if (suspend && from === "manuallySuspended") return null;
	if (!suspend && from === "none") return null;

	const changed = await transition(h, suspend ? "manuallySuspended" : "none", {
		event: suspend ? "manualSuspended" : "manualUnsuspended",
		source: "admin",
		actorId,
		reason,
		detail: { previousState: from },
		extra: suspend
			? { suspendedById: actorId, nextProbeAt: null, probeFailures: 0 }
			: {
					nextProbeAt: null,
					probeFailures: 0,
					// 解除したら不通の数え直しから始める。古い時刻のままだと、次の失敗 1 回で自動停止に戻ってしまう
					notRespondingSince: null,
					isNotResponding: false,
			  },
	});
	if (changed && !suspend) h.notRespondingSince = null;
	return changed ? from : null;
}

/**
 * 自動停止中のサーバの、生存確認の失敗を記録し、次の確認の日時を延ばす。
 *
 * @remarks
 * 間隔は 1 時間から倍々に延ばし、上限は 1 日。打ち切らない（今までは打ち切られて永久に放置されていた）。
 *
 * @param instance - 対象（自動停止中であること）
 * @param label - 失敗の説明
 * @internal
 */
export async function recordProbeFailure(
	instance: Pick<Instance, "id" | "probeFailures">,
	label: string,
): Promise<void> {
	const failures = instance.probeFailures + 1;
	const interval = Math.min(
		FIRST_PROBE_DELAY_MS * 2 ** Math.min(failures, 10),
		MAX_PROBE_INTERVAL_MS,
	);
	await Instances.update(
		{ id: instance.id, suspensionState: "autoSuspendedForNotResponding" },
		{
			probeFailures: failures,
			nextProbeAt: new Date(Date.now() + interval),
			suspendedReason: truncate(`生存確認に失敗（${label}）`),
		},
	);
}

/**
 * ブレーカーの開閉を履歴に残す。長期の状態は変えない。
 *
 * @remarks
 * queue ワーカーが複数になると、ワーカーごとに書かれる。区別できるよう `detail.worker` を入れる。
 *
 * @param event - ブレーカーのできごと
 * @internal
 */
export async function recordCircuitEvent(event: CircuitEvent): Promise<void> {
	const instance = await Instances.findOne({
		select: ["id"],
		where: { host: event.host },
	});
	const detail: Record<string, any> =
		event.type === "opened"
			? {
					failures: event.failures,
					lastError: event.lastError,
					cooldownMs: event.cooldownMs,
			  }
			: { openForMs: event.openForMs, by: event.by };
	detail.worker = cluster.worker?.id ?? process.pid;

	await InstanceHealthLogs.insert({
		id: genId(),
		createdAt: new Date(),
		instanceId: instance?.id ?? null,
		host: event.host,
		event: event.type === "opened" ? "circuitOpened" : "circuitClosed",
		fromState: null,
		toState: null,
		source: event.type === "closed" && event.by === "probe" ? "probe" : "deliver",
		actorId: null,
		reason:
			event.type === "opened"
				? `異なる ${event.failures} 件の配送が続けて失敗（${event.lastError}）`
				: null,
		detail,
	});
}

/**
 * 最終送受信日時などの統計を書いてよいか。ホストごとに {@link STATS_WRITE_INTERVAL_MS} に 1 回だけ true を返す。
 *
 * @remarks
 * これまでは配送・受信 1 件ごとに `Instances.update` していた（最適化監査 C-6）。
 * 値は「だいたいの最終日時」として使われているだけなので、間引いても困らない。
 *
 * @param host - ホスト（punycode）
 * @param kind - 送信（deliver）の統計か、受信（inbox）の統計か。書く列が違うので別々に間引く
 * @returns 書いてよければ true
 * @internal
 */
export function shouldWriteStats(
	host: string,
	kind: "sent" | "received",
): boolean {
	const key = `${kind}:${host}`;
	const now = Date.now();
	const last = lastStatsWriteAt.get(key) ?? 0;
	if (now - last < STATS_WRITE_INTERVAL_MS) return false;
	if (lastStatsWriteAt.size >= HEALTH_CACHE_MAX) lastStatsWriteAt.clear();
	lastStatsWriteAt.set(key, now);
	return true;
}

//#endregion 公開関数

//#region 非公開ヘルパー

/**
 * ホストの状態を返す。メモリに無いか古ければ DB から読む。
 *
 * @param host - ホスト（punycode）
 * @returns 状態。instance 行が無ければ null
 * @internal
 */
async function getHealth(host: string): Promise<HostHealth | null> {
	const cached = healthCache.get(host);
	if (cached && Date.now() - cached.loadedAt < HEALTH_CACHE_TTL_MS) {
		return cached;
	}

	const row = await Instances.findOne({
		select: ["id", "host", "suspensionState", "notRespondingSince"],
		where: { host },
	});
	if (row == null) return null;

	const h: HostHealth = {
		id: row.id,
		host: row.host,
		suspensionState: row.suspensionState,
		notRespondingSince: row.notRespondingSince,
		loadedAt: Date.now(),
	};
	if (healthCache.size >= HEALTH_CACHE_MAX) healthCache.clear();
	healthCache.set(host, h);
	return h;
}

/**
 * 停止状態を変え、同じトランザクションで履歴に 1 行書く。
 *
 * @remarks
 * 「今の状態が `h.suspensionState` のままなら」の条件で更新する。別の経路が先に変えていたら何もせず false を返す。
 * 変えたら、全プロセスの停止中ホストのキャッシュに知らせる。停止を解除したら、ブレーカーの状態も消す。
 *
 * @param h - 対象（メモリ上の状態。成功したら書き換える）
 * @param to - 新しい状態
 * @param opts - 履歴の内容など
 * @returns 変えたら true
 * @internal
 */
async function transition(
	h: HostHealth,
	to: InstanceSuspensionState,
	opts: TransitionOptions,
): Promise<boolean> {
	const from = h.suspensionState;
	const now = new Date();
	const reason = opts.reason != null ? truncate(opts.reason) : null;

	const changed = await db.transaction(async (em) => {
		const res = await em.update(
			Instance,
			{ id: h.id, suspensionState: from },
			{
				suspensionState: to,
				isSuspended: to !== "none",
				suspendedAt: to === "none" ? null : now,
				suspendedReason: to === "none" ? null : reason,
				suspendedById: null,
				...opts.extra,
			},
		);
		if (!res.affected) return false;

		await em.insert(InstanceHealthLog, {
			id: genId(),
			createdAt: now,
			instanceId: h.id,
			host: h.host,
			event: opts.event,
			fromState: from,
			toState: to,
			source: opts.source,
			actorId: opts.actorId ?? null,
			reason,
			detail: opts.detail ?? {},
		});
		return true;
	});

	if (!changed) {
		// 別の経路が先に変えていた。次は DB から読み直す
		healthCache.delete(h.host);
		return false;
	}

	h.suspensionState = to;
	applySuspensionChange(h.host, to);
	publishInternalEvent("instanceSuspensionChanged", {
		host: h.host,
		suspensionState: to,
	});
	if (to === "none") deliverCircuit.forget(h.host);

	logger.info(`${h.host}: ${from} -> ${to} (${opts.event}${reason ? `: ${reason}` : ""})`);
	return true;
}

/**
 * 理由の文字列を DB の列の長さに切り詰める。
 *
 * @param s - 文字列
 * @returns 切り詰めた文字列
 * @internal
 */
function truncate(s: string): string {
	return s.length > REASON_MAX_LENGTH ? `${s.slice(0, REASON_MAX_LENGTH - 1)}…` : s;
}

/**
 * 時間を「3 日」「5 時間」のような短い日本語にする。
 *
 * @param ms - ミリ秒
 * @returns 文字列
 * @internal
 */
function formatDuration(ms: number): string {
	const hours = Math.floor(ms / (60 * 60 * 1000));
	if (hours >= 48) return `${Math.floor(hours / 24)} 日間`;
	return `${hours} 時間`;
}

//#endregion 非公開ヘルパー

// 他のプロセスで停止状態が変わったら、このホストの状態を読み直す
subscriber.on("message", (_, data) => {
	try {
		const obj = JSON.parse(data);
		if (obj.channel !== "internal") return;
		if (obj.message?.type !== "instanceSuspensionChanged") return;
		const cached = healthCache.get(obj.message.body.host);
		if (cached) cached.suspensionState = obj.message.body.suspensionState;
	} catch {
		// 他チャンネルのメッセージは無視
	}
});
