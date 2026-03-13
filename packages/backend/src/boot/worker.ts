/**
 * @packageDocumentation
 *
 * ワーカープロセスの起動。DB 初期化・サーバ/キュー起動・親プロセスへの ready 通知を行う。
 *
 * @remarks
 * - **役割**: クラスタの worker で実行。initDb 後に mode に応じて server または queue を起動。boot/index から呼ばれる。
 *
 * @see {@link boot/index} ブートエントリ
 * @see {@link boot/master} マスター起動
 * @internal
 */
import cluster from "node:cluster";
import { initDb } from "@/db/postgre.js";
import os from "node:os";

/**
 * Init worker process
 */
export async function workerMain() {
	await initDb();

	if (!process.env.mode || process.env.mode === "web") {
		// start server
		await import("../server/index.js").then((x) => x.default());
	}

	if (!process.env.mode || process.env.mode === "queue") {
		// start job queue
		import("../queue/index.js").then((x) => x.default());

		if (process.env.mode === "queue") {
			// if this is an exclusive queue worker, renice to have higher priority
			os.setPriority(os.constants.priority.PRIORITY_LOW);
		}
	}

	if (cluster.isWorker) {
		// Send a 'ready' message to parent process
		process.send!("ready");
	}
}
