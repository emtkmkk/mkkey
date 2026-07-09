/**
 * @packageDocumentation
 *
 * キュー処理用ロガー。deliver / noteApDeliver 等のサブロガーを集約する。
 *
 * @remarks
 * - **役割**: queue/index や note 配信ジョブから共有参照される。
 *
 * @internal
 */
import Logger from "@/services/logger.js";

export const queueLogger = new Logger("queue", "orange");
export const noteApDeliverLogger = queueLogger.createSubLogger("noteApDeliver");
export const deliverJobLogger = queueLogger.createSubLogger("deliver");
