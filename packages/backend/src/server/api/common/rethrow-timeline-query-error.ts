/**
 * @packageDocumentation
 *
 * タイムライン系 API の DB 取得・pack 失敗時に、実例外をログへ残してから ApiError で再throwする。
 *
 * @remarks
 * - 従来 catch ですべて「フォロー数を増やしてください」に寄せていたが、失敗原因は SQL・pack 等様々なため利用者を誤解させる。クライアント向けは `queryError.message` の中立文言に統一する。
 * - 運用向けに `apiLogger` へ元の例外を残す（call 層のログは ApiError のメッセージ中心になりがちなため）。
 *
 * @internal
 */
import { apiLogger } from "../logger.js";
import { ApiError } from "../error.js";

/**
 * タイムライン内側の try/catch で捕捉した例外をログし、定義済み queryError で ApiError に変換する。
 *
 * @param endpoint - ログ用の API 名（例: `notes/hybrid-timeline`）
 * @param queryError - エンドポイント `meta.errors.queryError`（message はフォロー数と無関係な汎用文にすること）
 * @param caught - 捕捉した例外
 * @throws {ApiError} 常に `queryError` に基づく ApiError を投げる（戻らない）
 *
 * @internal
 */
export function rethrowTimelineQueryAsApiError(
	endpoint: string,
	queryError: { message: string; code: string; id: string },
	caught: unknown,
): never {
	apiLogger.error(`${endpoint}: timeline query or pack failed`, {
		error: caught,
	});
	throw new ApiError(queryError);
}
