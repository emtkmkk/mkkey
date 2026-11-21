/**
 * @packageDocumentation
 *
 * 配送先サーバの健康状態を扱う層の入口。配送処理はここを通してサーキットブレーカーと長期の状態を使う。
 *
 * @remarks
 * - **役割**: 送る前の判断（{@link beforeDeliver}）、送った結果の記録（{@link recordDeliverSuccess} / {@link recordDeliverError}）、
 *   不調なサーバの復帰の確認（nodeinfo の取得）をまとめる。
 * - ブレーカー（一時停止）の状態はこのプロセス（queue ワーカー）のメモリにだけある。開閉は履歴にも残す。
 * - 長期の状態（不通の時刻・自動停止・閉鎖停止）の書き換えは {@link ./state.ts} に任せる。
 * - 画面用に、一時停止中のサーバの一覧などを 10 秒ごとに Redis へ書く（{@link HEALTH_SNAPSHOT_KEY}）。
 * - 計画: `plans/instance-delivery-health-plan.md`。
 *
 * @internal
 */
import type Bull from "bull";
import { redisClient } from "@/db/redis.js";
import { toPuny } from "@/misc/convert-host.js";
import Logger from "@/services/logger.js";
import type { DeliverJobData } from "@/queue/types.js";
import { getAdaptiveDelayMs } from "@/queue/adaptive-queue-throttle.js";
import type { CircuitEvent, OpenCircuitSnapshot } from "./circuit.js";
import {
	classifyDeliverError,
	toHostDownAfterConnectCheck,
	type DeliverOutcome,
} from "./classify.js";
import { checkTcpConnect } from "./connect-check.js";
import { deliverCircuit } from "./deliver-circuit.js";
import { probeNodeinfo } from "./probe.js";
import {
	markGone,
	noteHostAlive,
	noteHostDown,
	recordCircuitEvent,
} from "./state.js";

export { deliverCircuit };

const logger = new Logger("instance-health", "yellow");

/** 個人 inbox の 410 のあと、サーバ自体の閉鎖を nodeinfo で確かめる最短間隔（ホストごと） */
const GONE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** 画面用のスナップショットを Redis に書く間隔 */
const SNAPSHOT_INTERVAL_MS = 10 * 1000;

/**
 * 画面用のスナップショットの Redis キー（ioredis の keyPrefix が前に付く）。
 *
 * @internal
 */
export const HEALTH_SNAPSHOT_KEY = "instanceHealth:snapshot";

/**
 * 画面用のスナップショット。queue ワーカーが書き、web ワーカーの API が読む。
 *
 * @remarks
 * 一時停止の状態は queue ワーカーのメモリにしか無いため、この形で渡す（計画 設計方針 7「データの取り方」）。
 * TODO: queue ワーカーを複数にしたら、ワーカーごとのキーにして API 側で合わせる。今は上書きし合う。
 *
 * @internal
 */
export type HealthSnapshot = {
	/** 書いた時刻（ミリ秒） */
	updatedAt: number;
	/** 一時停止中のサーバ */
	openCircuits: OpenCircuitSnapshot[];
	/** 直近 24 時間に、通信せずに返した配送の件数（このワーカーの起動後の分だけ） */
	skipped24h: number;
	/** 直近 24 時間に、ブレーカーが開いた回数（同上） */
	opened24h: number;
	/** 適応スロットルが今かけている待ち時間（ミリ秒） */
	adaptiveDelayMs: number;
	/** このワーカーが動き始めた時刻（ミリ秒） */
	startedAt: number;
};

//#region 集計

/**
 * 1 時間ごとの件数を、直近 24 時間分だけ持つ数え上げ。
 *
 * @internal
 */
class HourlyCounter {
	/** 時（1970 年からの時間数） → 件数 */
	private readonly buckets = new Map<number, number>();

	/** 1 件数える */
	public inc(): void {
		const hour = Math.floor(Date.now() / 3600000);
		this.buckets.set(hour, (this.buckets.get(hour) ?? 0) + 1);
		for (const key of this.buckets.keys()) {
			if (key <= hour - 24) this.buckets.delete(key);
		}
	}

	/** 直近 24 時間の合計 */
	public sum(): number {
		const from = Math.floor(Date.now() / 3600000) - 23;
		let total = 0;
		for (const [key, n] of this.buckets) if (key >= from) total += n;
		return total;
	}
}

//#endregion 集計

//#region フィールド

/** ホスト → 最後に閉鎖を確かめた時刻 */
const lastGoneCheckAt = new Map<string, number>();

/** 1 時間ごとの「通信せずに返した件数」（直近 24 時間分） */
const skippedBuckets = new HourlyCounter();

/** 1 時間ごとの「ブレーカーが開いた回数」（直近 24 時間分） */
const openedBuckets = new HourlyCounter();

/** スナップショットを書くタイマー（queue ワーカーで最初の配送のときに始める） */
let snapshotTimer: ReturnType<typeof setInterval> | null = null;

/** このワーカーで健康状態の層が動き始めた時刻 */
let startedAt = 0;

//#endregion フィールド

//#region 例外

/**
 * サーキットブレーカーで送らずに返したことを表す例外。
 *
 * @remarks
 * - 投げると Bull の通常の再送（apBackoff）に任せることになり、再送回数を 1 回使う（計画の決定事項 Q2 の案 A）。
 * - 通信していないので、配送の統計（チャート・`instance` 行）には数えない。
 * - キューの失敗ログでは warn にしない（{@link isHostCircuitOpenError}）。
 *
 * @internal
 */
export class HostCircuitOpenError extends Error {
	/**
	 * @param host - 配送先ホスト
	 * @param reason - 送らなかった理由
	 * @param until - 次に送ってよい（確認する）時刻
	 */
	constructor(
		public readonly host: string,
		public readonly reason: "open" | "rateLimited",
		public readonly until: number,
	) {
		super(
			`circuit ${reason} for ${host} until ${new Date(until).toISOString()}`,
		);
		this.name = "HostCircuitOpenError";
	}
}

/**
 * 例外が {@link HostCircuitOpenError} かどうか。
 *
 * @param err - 例外
 * @returns HostCircuitOpenError なら true
 * @internal
 */
export function isHostCircuitOpenError(err: unknown): boolean {
	return (
		err instanceof HostCircuitOpenError ||
		(typeof err === "object" &&
			err != null &&
			(err as { name?: unknown }).name === "HostCircuitOpenError")
	);
}

//#endregion 例外

//#region 公開関数

/**
 * 送る前に、送ってよいかを判断する。送ってはいけない場合は例外を投げる。
 *
 * @remarks
 * 不調なサーバで、待ち時間が過ぎていれば、ここで復帰の確認を 1 本だけ始める（結果は待たない）。
 *
 * @param host - 配送先ホスト（punycode）
 * @param inboxUrl - 配送先の inbox（確認の URL を作るのに使う）
 * @throws HostCircuitOpenError 送らずに返す場合
 * @internal
 */
export function beforeDeliver(host: string, inboxUrl: string): void {
	startSnapshotTimer();

	const decision = deliverCircuit.check(host);
	if (decision.action === "send") return;

	if (decision.startProbe) {
		void probe(host, inboxUrl);
	}

	skippedBuckets.inc();
	throw new HostCircuitOpenError(host, decision.reason, decision.until);
}

/**
 * 配送の成功を記録する。
 *
 * @param host - 配送先ホスト（punycode）
 * @param jobId - ジョブ ID
 * @internal
 */
export async function recordDeliverSuccess(
	host: string,
	jobId: Bull.JobId,
): Promise<void> {
	const event = deliverCircuit.recordResult(host, String(jobId), {
		kind: "success",
		label: "2xx",
	});
	if (event) handleCircuitEvent(event);
	await noteHostAlive(host, "deliver");
}

/**
 * 配送の失敗を分類して記録する。
 *
 * @remarks
 * - タイムアウトで、接続段階で止まったのかが分からないときは、TCP 接続を試して判定する（{@link checkTcpConnect}）。
 * - `hostDown` なら長期の状態に「不通」を伝える（3 日続けば自動停止）。
 * - 4xx（相手のアプリが応答した）なら、不通の記録を消す。
 * - shared inbox の 410 は閉鎖停止にする。個人 inbox の 410 は、1 日 1 回まで nodeinfo でサーバ自体の閉鎖かを確かめる。
 *
 * @param host - 配送先ホスト（punycode）
 * @param job - 配送ジョブ
 * @param error - 配送で投げられた例外
 * @returns 分類の結果
 * @internal
 */
export async function recordDeliverError(
	host: string,
	job: Bull.Job<DeliverJobData>,
	error: unknown,
): Promise<DeliverOutcome> {
	let outcome = classifyDeliverError(error, {
		isSharedInbox: job.data.isSharedInbox,
	});

	if (outcome.needsConnectCheck) {
		const connected = await checkTcpConnect(job.data.to).catch(() => true);
		if (!connected) outcome = toHostDownAfterConnectCheck(outcome);
	}

	const event = deliverCircuit.recordResult(host, String(job.id), outcome);
	if (event) handleCircuitEvent(event);

	try {
		switch (outcome.kind) {
			case "hostDown":
				await noteHostDown(host, {
					source: "deliver",
					label: outcome.label,
					statusCode: outcome.statusCode,
				});
				break;
			case "gone":
				await markGone(host, "deliver", {
					url: job.data.to,
					via: "sharedInbox",
				});
				break;
			case "recipientError":
			case "rateLimited":
				await noteHostAlive(host, "deliver");
				if (outcome.statusCode === 410) void checkGoneByNodeinfo(host, job.data.to);
				break;
		}
	} catch (e) {
		// 長期の状態の記録に失敗しても、配送ジョブの結果（再送するか）は変えない
		logger.warn(`failed to record health of ${host}: ${e}`);
	}

	return outcome;
}

/**
 * 適応スロットル（{@link ../../queue/adaptive-queue-throttle.ts}）の前段で、
 * このジョブを送らずに返すかを調べる。送らないジョブは、待ちを入れず、平均処理時間・エラー率にも数えない。
 *
 * @param job - 配送ジョブ
 * @returns 送らずに返すなら true
 * @internal
 */
export function shouldBypassDeliver(job: Bull.Job<DeliverJobData>): boolean {
	try {
		return deliverCircuit.wouldSkip(toPuny(new URL(job.data.to).host));
	} catch {
		return false;
	}
}

/**
 * 画面用のスナップショットを Redis から読む（web ワーカーの API 用）。
 *
 * @returns スナップショット。queue ワーカーがまだ書いていない・古すぎる場合は null
 * @internal
 */
export async function readHealthSnapshot(): Promise<HealthSnapshot | null> {
	const raw = await redisClient.get(HEALTH_SNAPSHOT_KEY);
	if (raw == null) return null;
	try {
		return JSON.parse(raw) as HealthSnapshot;
	} catch {
		return null;
	}
}

//#endregion 公開関数

//#region 非公開ヘルパー

/**
 * 不調なサーバに nodeinfo を取りに行き、応答があればブレーカーを閉じる。
 *
 * @remarks
 * 応答が無ければ、長期の状態に「不通」を伝える。一時停止中は配送が来ないので、
 * 自動停止の判定（3 日）はこの確認の失敗で進む。
 *
 * @param host - 配送先ホスト
 * @param inboxUrl - 配送先の inbox
 * @internal
 */
async function probe(host: string, inboxUrl: string): Promise<void> {
	const result = await probeNodeinfo(inboxUrl);

	const event = deliverCircuit.recordProbeResult(
		host,
		result.alive,
		result.label,
	);
	if (event) {
		handleCircuitEvent(event);
	} else if (!result.alive) {
		logger.debug(`probe failed ${host}: ${result.label}`);
	}

	try {
		if (result.alive) {
			await noteHostAlive(host, "probe", { statusCode: result.statusCode });
		} else {
			await noteHostDown(host, {
				source: "probe",
				label: result.label ?? "unknown",
				statusCode: result.statusCode,
			});
		}
	} catch (e) {
		logger.warn(`failed to record health of ${host}: ${e}`);
	}
}

/**
 * 個人 inbox が 410 を返したとき、サーバ自体が閉鎖したのかを nodeinfo で確かめる。
 *
 * @remarks
 * Mastodon は削除されたアカウントの inbox に 410 を返すので、それだけではサーバを止めない。
 * nodeinfo も 410 なら、サーバ自体の閉鎖とみなす。確認は 1 サーバにつき 1 日 1 回まで。
 *
 * @param host - 配送先ホスト
 * @param inboxUrl - 410 を返した inbox
 * @internal
 */
async function checkGoneByNodeinfo(host: string, inboxUrl: string): Promise<void> {
	const now = Date.now();
	if (now - (lastGoneCheckAt.get(host) ?? 0) < GONE_CHECK_INTERVAL_MS) return;
	if (lastGoneCheckAt.size >= 10000) lastGoneCheckAt.clear();
	lastGoneCheckAt.set(host, now);

	const result = await probeNodeinfo(inboxUrl);
	if (result.statusCode !== 410) return;

	await markGone(host, "deliver", { url: result.url, via: "nodeinfo" }).catch(
		(e) => logger.warn(`failed to mark ${host} as gone: ${e}`),
	);
}

/**
 * ブレーカーの状態の変化をログと履歴に残す。
 *
 * @param event - できごと
 * @internal
 */
function handleCircuitEvent(event: CircuitEvent): void {
	if (event.type === "opened") {
		openedBuckets.inc();
		logger.warn(
			`circuit opened ${event.host}: ${event.failures} jobs failed (last: ${event.lastError}), retry in ${Math.round(event.cooldownMs / 1000)}s`,
		);
	} else {
		logger.info(
			`circuit closed ${event.host} by ${event.by} after ${Math.round(event.openForMs / 1000)}s`,
		);
	}
	void recordCircuitEvent(event).catch((e) =>
		logger.warn(`failed to record circuit event of ${event.host}: ${e}`),
	);
}

/**
 * 画面用のスナップショットを書くタイマーを始める（1 回だけ）。
 *
 * @remarks
 * 配送を処理するプロセス（queue ワーカー）だけで動かしたいので、最初の配送のときに始める。
 * このファイルは web ワーカーからも import されるため、読み込んだ時点では始めない。
 *
 * @internal
 */
function startSnapshotTimer(): void {
	if (snapshotTimer != null) return;
	startedAt = Date.now();
	snapshotTimer = setInterval(() => {
		const snapshot: HealthSnapshot = {
			updatedAt: Date.now(),
			openCircuits: deliverCircuit.snapshot(),
			skipped24h: skippedBuckets.sum(),
			opened24h: openedBuckets.sum(),
			adaptiveDelayMs: getAdaptiveDelayMs("deliver"),
			startedAt,
		};
		redisClient
			.set(HEALTH_SNAPSHOT_KEY, JSON.stringify(snapshot), "EX", 60)
			.catch(() => undefined);
	}, SNAPSHOT_INTERVAL_MS);
	snapshotTimer.unref?.();
}

//#endregion 非公開ヘルパー
