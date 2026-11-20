/**
 * @packageDocumentation
 *
 * 配送先サーバの健康状態を扱う層の入口。配送処理はここを通してサーキットブレーカーを使う。
 *
 * @remarks
 * - **役割**: 送る前の判断（{@link beforeDeliver}）、送った結果の記録（{@link recordDeliverSuccess} / {@link recordDeliverError}）、
 *   不調なサーバの復帰の確認（nodeinfo の取得）をまとめる。
 * - ブレーカーの状態はこのプロセス（queue ワーカー）のメモリにだけある。
 * - 計画: `plans/instance-delivery-health-plan.md`。今は手順 1〜3（ブレーカー）まで。
 *   TODO: 手順 5 で、状態の変化を履歴テーブル（`instance_health_log`）に書く。今はログに出すだけ。
 *   TODO: 手順 4〜7 で、長期の停止（`suspensionState`）と自動停止・解除もここに集める。
 *
 * @internal
 */
import type Bull from "bull";
import config from "@/config/index.js";
import { getResponse } from "@/misc/fetch.js";
import { toPuny } from "@/misc/convert-host.js";
import Logger from "@/services/logger.js";
import type { DeliverJobData } from "@/queue/types.js";
import { HostCircuitBreaker, type CircuitEvent } from "./circuit.js";
import {
	classifyDeliverError,
	isProbeAlive,
	toHostDownAfterConnectCheck,
	type DeliverOutcome,
} from "./classify.js";
import { checkTcpConnect } from "./connect-check.js";

const logger = new Logger("instance-health", "yellow");

/** 復帰の確認（nodeinfo の取得）を打ち切るまでの時間（ミリ秒） */
const PROBE_TIMEOUT_MS = 10 * 1000;

/**
 * 配送用のサーキットブレーカー。このプロセスで 1 つだけ使う。
 *
 * @remarks
 * 中身は可変（ホストごとの状態を持つ）。
 *
 * @internal
 */
export const deliverCircuit = new HostCircuitBreaker();

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
	const decision = deliverCircuit.check(host);
	if (decision.action === "send") return;

	if (decision.startProbe) {
		void probe(host, inboxUrl);
	}

	throw new HostCircuitOpenError(host, decision.reason, decision.until);
}

/**
 * 配送の成功を記録する。
 *
 * @param host - 配送先ホスト（punycode）
 * @param jobId - ジョブ ID
 * @internal
 */
export function recordDeliverSuccess(host: string, jobId: Bull.JobId): void {
	const event = deliverCircuit.recordResult(host, String(jobId), {
		kind: "success",
		label: "2xx",
	});
	if (event) logEvent(event);
}

/**
 * 配送の失敗を分類して記録する。
 *
 * @remarks
 * タイムアウトで、接続段階で止まったのかが分からないときは、TCP 接続を試して判定する（{@link checkTcpConnect}）。
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
	if (event) logEvent(event);

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

//#endregion 公開関数

//#region 非公開ヘルパー

/**
 * 不調なサーバに nodeinfo を取りに行き、応答があればブレーカーを閉じる。
 *
 * @remarks
 * 配送ジョブではなく、内容に依存しない軽いリクエストで確認する。
 * 本物の配送で確認すると、内容が原因で失敗するジョブを引いたときに閉じたままになるため。
 *
 * @param host - 配送先ホスト
 * @param inboxUrl - 配送先の inbox
 * @internal
 */
async function probe(host: string, inboxUrl: string): Promise<void> {
	let error: unknown = null;
	try {
		const url = new URL("/.well-known/nodeinfo", inboxUrl).toString();
		const res = await getResponse({
			url,
			method: "GET",
			headers: {
				Accept: "application/json",
				"User-Agent": config.userAgent,
			},
			totalTimeoutMs: PROBE_TIMEOUT_MS,
			size: 64 * 1024,
		});
		// 本文を読み切って接続を解放する（中身は使わない）
		await res.arrayBuffer().catch(() => undefined);
	} catch (e) {
		error = e;
	}

	const alive = isProbeAlive(error);
	const label =
		error == null
			? undefined
			: classifyDeliverError(error, { isSharedInbox: false }).label;
	const event = deliverCircuit.recordProbeResult(host, alive, label);
	if (event) {
		logEvent(event);
	} else if (!alive) {
		logger.debug(`probe failed ${host}: ${label}`);
	}
}

/**
 * ブレーカーの状態の変化をログに出す。
 *
 * @param event - できごと
 * @internal
 */
function logEvent(event: CircuitEvent): void {
	if (event.type === "opened") {
		logger.warn(
			`circuit opened ${event.host}: ${event.failures} jobs failed (last: ${event.lastError}), retry in ${Math.round(event.cooldownMs / 1000)}s`,
		);
	} else {
		logger.info(
			`circuit closed ${event.host} by ${event.by} after ${Math.round(event.openForMs / 1000)}s`,
		);
	}
}

//#endregion 非公開ヘルパー
