/**
 * @packageDocumentation
 *
 * API 用のロガーインスタンス。リクエスト・エラー等のログ出力に利用する。
 *
 * @remarks
 * - **役割**: api-handler や call から参照され、API 関連のログを "api" チャンネルで出力する。
 *
 * @see {@link api-handler} リクエスト処理
 * @internal
 */
import Logger from "@/services/logger.js";

export const apiLogger = new Logger("api");
