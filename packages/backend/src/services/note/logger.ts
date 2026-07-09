/**
 * @packageDocumentation
 *
 * ノートサービス用ロガー。作成・削除・配信メトリクス等のログ出力に利用する。
 *
 * @remarks
 * - **役割**: create / delete / ap-deliver から参照される。
 *
 * @internal
 */
import { queueLogger, noteApDeliverLogger } from "@/queue/logger.js";

export const noteLogger = queueLogger.createSubLogger("note");
export { noteApDeliverLogger };
