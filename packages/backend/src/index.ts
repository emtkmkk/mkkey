/**
 * @packageDocumentation
 *
 * バックエンドのエントリポイント。boot を起動する。
 *
 * @remarks
 * - **役割**: プロセス起動時に boot を実行し、HTTP・キュー・daemon 等を立ち上げる。
 *
 * @see {@link boot/index} 起動処理
 * @internal
 */

import { EventEmitter } from "node:events";
import boot from "./boot/index.js";

Error.stackTraceLimit = Infinity;
EventEmitter.defaultMaxListeners = 128;

boot().catch((err) => {
	console.error(err);
});
