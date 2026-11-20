/**
 * @packageDocumentation
 *
 * キューのジョブ 1 回あたりの実行上限（タイムアウト）を config から決める。
 *
 * @remarks
 * - **役割**: キューへの登録（{@link ./index.ts}）と、配送処理（{@link ./processors/deliver.ts}）の両方から同じ値を使う。
 *   配送処理は、ジョブのタイムアウトより少し早く通信を打ち切り、失敗を自分で受け取って分類する。
 * - CHANGED: deliver の既定値を 60 秒から 30 秒にした（2026-11-20、計画の決定事項 Q8）。
 *   通信自体は 10 秒ごとの単位で見ており、応答の無いサーバが処理枠を 60 秒ふさぐのを減らすため。
 *   noteApDeliver は配送先の組み立てに時間がかかることがあるので、60 秒のまま。
 *   config の `deliverJobTimeoutMs` を書いた場合は、今までどおり両方にその値を使う。
 *
 * @internal
 */
import config from "@/config/index.js";

/** deliver の既定のタイムアウト（ミリ秒） */
const DEFAULT_DELIVER_JOB_TIMEOUT_MS = 30 * 1000;
/** noteApDeliver の既定のタイムアウト（ミリ秒） */
const DEFAULT_NOTE_AP_DELIVER_JOB_TIMEOUT_MS = 60 * 1000;
/** inbox の既定のタイムアウト（ミリ秒） */
const DEFAULT_INBOX_JOB_TIMEOUT_MS = 5 * 60 * 1000;
/** これより小さい値は異常値として既定値に戻す */
const MIN_JOB_TIMEOUT_MS = 1000;

/**
 * 配送が通信を打ち切るのを、ジョブのタイムアウトより何ミリ秒早くするか。
 *
 * @internal
 */
const DELIVER_REQUEST_MARGIN_MS = 5 * 1000;

/**
 * config の値を検証し、異常値なら既定値を返す。
 *
 * @param value - config の値
 * @param fallback - 既定値
 * @returns タイムアウト（ミリ秒）
 * @internal
 */
function resolve(value: number | undefined, fallback: number): number {
	const ms = value ?? fallback;
	return ms >= MIN_JOB_TIMEOUT_MS ? ms : fallback;
}

/**
 * deliver ジョブのタイムアウト（ミリ秒）。
 *
 * @returns タイムアウト
 * @internal
 */
export function getDeliverJobTimeoutMs(): number {
	return resolve(config.deliverJobTimeoutMs, DEFAULT_DELIVER_JOB_TIMEOUT_MS);
}

/**
 * noteApDeliver ジョブのタイムアウト（ミリ秒）。
 *
 * @returns タイムアウト
 * @internal
 */
export function getNoteApDeliverJobTimeoutMs(): number {
	return resolve(
		config.deliverJobTimeoutMs,
		DEFAULT_NOTE_AP_DELIVER_JOB_TIMEOUT_MS,
	);
}

/**
 * inbox ジョブのタイムアウト（ミリ秒）。
 *
 * @returns タイムアウト
 * @internal
 */
export function getInboxJobTimeoutMs(): number {
	return resolve(config.inboxJobTimeoutMs, DEFAULT_INBOX_JOB_TIMEOUT_MS);
}

/**
 * 配送の通信を打ち切るまでの時間（ミリ秒）。ジョブのタイムアウトより少し短くする。
 *
 * @remarks
 * ジョブのタイムアウト（Bull）で打ち切られると、配送処理の外で失敗するため、失敗の分類ができない。
 * 先に通信を打ち切れば、配送処理の catch で例外を受け取れる。
 *
 * @returns 打ち切るまでの時間
 * @internal
 */
export function getDeliverRequestTimeoutMs(): number {
	const job = getDeliverJobTimeoutMs();
	return Math.max(MIN_JOB_TIMEOUT_MS, job - DELIVER_REQUEST_MARGIN_MS);
}
