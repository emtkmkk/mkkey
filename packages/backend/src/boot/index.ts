/**
 * @packageDocumentation
 *
 * ブートエントリ。クラスタの master/worker 起動・プロセス優先度・イベント購読を行う。
 *
 * @remarks
 * - **役割**: エントリポイント。master なら masterMain、worker なら workerMain を実行。Xev でイベント購読。
 *
 * @see {@link master} マスター起動
 * @see {@link worker} ワーカー起動
 * @internal
 */
import cluster from "node:cluster";
import chalk from "chalk";
import Xev from "xev";

import Logger from "@/services/logger.js";
import { envOption } from "../env.js";

// TypeORM 用
import "reflect-metadata";
import { masterMain } from "./master.js";
import { workerMain } from "./worker.js";
import os from "node:os";

const logger = new Logger("core", "cyan");
const clusterLogger = logger.createSubLogger("cluster", "orange", false);
const ev = new Xev();

/**
 * プロセスを初期化する。master/worker の起動と優先度設定を行う。
 * @returns Promise（resolve 時は void）
 * @internal
 */
export default async function () {
	const mode =
		process.env.mode && ["web", "queue"].includes(process.env.mode)
			? `(${process.env.mode})`
			: "";
	const type = cluster.isPrimary ? "(master)" : "(worker)";
	const index = `<${process.env.index}>`;
	process.title = ["Calckey", mode, type, index].filter(Boolean).join(" ");

	if (cluster.isPrimary || envOption.disableClustering) {
		await masterMain();
		if (cluster.isPrimary) {
			ev.mount();
		}
	}

	if (cluster.isWorker || envOption.disableClustering) {
		await workerMain();
	}

	if (cluster.isPrimary) {
		// マスタープセスはやや低めの優先度にする（低すぎない程度）
		os.setPriority(2);
	}
	if (cluster.isWorker && process.env.mode === "web") {
		// ワーカーをかなり低い優先度にし、マスターが API に応答しやすくする
		os.setPriority(10);
	} else if (cluster.isWorker) {
		os.setPriority(19);
	}

	// 単体テスト等で子プロセスとして起動した場合。process.send が使えるときだけ送信
	if (process.send) {
		process.send("ok");
	}
}

//#region クラスタ・プロセスイベント

// ワーカーフォーク時
cluster.on("fork", (worker) => {
	clusterLogger.debug(`Process forked: [${worker.id}]`);
});

// ワーカーオンライン時
cluster.on("online", (worker) => {
	clusterLogger.debug(`Process is now online: [${worker.id}]`);
});

// ワーカー終了時（死んだワーカーを置き換える）
cluster.on("exit", (worker) => {
	clusterLogger.error(chalk.red(`[${worker.id}] died :(`));
	cluster.fork();
});

// 未処理の Promise rejection の詳細を表示
if (!envOption.quiet) {
	process.on("unhandledRejection", console.dir);
}

// 未捕捉例外の詳細を表示
process.on("uncaughtException", (err) => {
	try {
		logger.error(err);
	} catch {}
});

// プロセス終了時
process.on("exit", (code) => {
	logger.info(`The process is going to exit with code ${code}`);
});

//#endregion クラスタ・プロセスイベント
