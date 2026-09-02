/**
 * @packageDocumentation
 *
 * ブートエントリ。クラスタの master/worker 起動・プロセス優先度・イベント購読を行う。
 *
 * @remarks
 * - **役割**: エントリポイント。master なら masterMain、worker なら workerMain を実行。Xev でイベント購読。
 * - **クラスタ**: プライマリのみ `cluster` の fork / exit / シグナル処理を登録する。ワーカー異常終了時は `mode`/`index`/`proxy` を復元して fork し、連続失敗時はバックオフと上限でマスターを止める。
 * - **優先度の最終形**: プライマリは `setPriority(2)`。`mode===web` のワーカーは `10`。それ以外のワーカー（主に queue）はここでは `19` とするが、{@link workerMain} 内で queue 専用なら `PRIORITY_LOW` に上書きされ、キュー処理の相対優先度が決まる。
 *
 * @see {@link master} マスター起動
 * @see {@link worker} ワーカー起動
 * @internal
 */
import cluster, { type Worker as ClusterWorker } from "node:cluster";
import chalk from "chalk";
import Xev from "xev";

import Logger from "@/services/logger.js";
import { envOption } from "../env.js";

// TypeORM 用
import "reflect-metadata";
import { masterMain } from "./master.js";
import { workerMain } from "./worker.js";
import {
	getWorkerInfo,
	registerWorker,
	unregisterWorker,
} from "./worker-registry.js";
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

//#region クラスタ・プロセスイベント（プライマリ専用）

/**
 * プライマリでのみ cluster のライフサイクルとシグナル処理を登録する。
 *
 * @remarks
 * - ワーカープロセスでは `cluster.on("exit")` 等を登録しない（不要かつ誤 fork を避ける）。
 * - シャットダウン中は `exit` での自動復帰 fork を行わない。
 *
 * @internal
 */
function setupClusterPrimaryHandlers(): void {
	/** 意図的シャットダウン中はワーカー exit での fork を抑止する */
	let isShuttingDown = false;

	/** ワーカー識別子（mode + index）ごとの直近終了時刻（連続失敗検出用） */
	const restartTimestamps = new Map<string, number[]>();

	const RESTART_WINDOW_MS = 60_000;
	const MAX_RESTARTS_IN_WINDOW = 15;

	/**
	 * 同一スロットの再起動が短時間に多すぎないか記録し、続行可否を返す。
	 * @param slotKey - `mode:index` 形式のキー
	 * @returns 許容内なら true。上限超過なら false。
	 */
	function recordRestartAttempt(slotKey: string): boolean {
		const now = Date.now();
		const windowStart = now - RESTART_WINDOW_MS;
		const prev = (restartTimestamps.get(slotKey) ?? []).filter((t) => t > windowStart);
		prev.push(now);
		restartTimestamps.set(slotKey, prev);
		// ウィンドウ内の終了が MAX 回まで。それ以上はマスターを落として連打を止める
		return prev.length <= MAX_RESTARTS_IN_WINDOW;
	}

	/**
	 * 連続失敗に応じた fork 前待機（指数バックオフ、上限付き）。
	 * @param attemptCount - ウィンドウ内の試行回数（1 始まり想定）
	 */
	function backoffMsForAttempt(attemptCount: number): number {
		if (attemptCount <= 1) return 0;
		return Math.min(25_000, 250 * 2 ** Math.min(attemptCount - 2, 10));
	}

	// ワーカーフォーク時
	cluster.on("fork", (worker) => {
		clusterLogger.debug(`Process forked: [${worker.id}]`);
	});

	// ワーカーオンライン時
	cluster.on("online", (worker) => {
		clusterLogger.debug(`Process is now online: [${worker.id}]`);
	});

	// ワーカー終了時（役割を保ったまま置き換え。連打・クラッシュループは抑止）
	cluster.on("exit", (worker, code, signal) => {
		if (isShuttingDown) {
			clusterLogger.info(
				`[${worker.id}] exited during shutdown (code=${code}, signal=${signal ?? "none"})`,
			);
			return;
		}

		// NOTE: `worker.process` は ChildProcess で、fork 時に渡した env は読み出せない
		// （`ChildProcess.env` は存在せず常に undefined）。役割は fork 時に登録した
		// レジストリから引く。 @see boot/worker-registry
		const info = getWorkerInfo(worker.id);
		unregisterWorker(worker.id);

		if (info == null) {
			clusterLogger.error(
				chalk.red(
					`[${worker.id}] died but was never registered (code=${code}, signal=${signal ?? "none"}); cannot respawn safely.`,
				),
			);
			clusterLogger.error(
				"Stopping master to avoid starting a worker with ambiguous web+queue mode.",
				null,
				true,
			);
			process.exit(1);
		}

		const { mode, index, proxy } = info;

		const slotKey = `${mode}:${index}`;

		if (!recordRestartAttempt(slotKey)) {
			clusterLogger.error(
				chalk.red(
					`[${worker.id}] Too many restarts for ${slotKey} within ${RESTART_WINDOW_MS}ms; exiting master.`,
				),
				null,
				true,
			);
			process.exit(1);
		}

		const attemptsInWindow = restartTimestamps.get(slotKey)!.length;
		const delayMs = backoffMsForAttempt(attemptsInWindow);
		clusterLogger.error(
			chalk.red(
				`[${worker.id}] died (code=${code}, signal=${signal ?? "none"}) — respawning ${mode} index=${index} proxy=${proxy} in ${delayMs}ms`,
			),
		);

		setTimeout(() => {
			if (isShuttingDown) return;
			const replacement = cluster.fork({ mode, index, proxy });
			// 置き換え後のワーカーも役割を引けるようにする（次回の exit のため）
			registerWorker(replacement.id, { mode, index, proxy });
		}, delayMs);
	});

	/**
	 * SIGTERM / SIGINT 受信時に子ワーカーを止めてからマスターを終了する。
	 * @param signal - 受信したシグナル名
	 */
	function beginShutdown(signal: NodeJS.Signals): void {
		if (isShuttingDown) return;
		isShuttingDown = true;
		clusterLogger.info(`Received ${signal}, stopping workers...`);

		const workers = Object.values(cluster.workers ?? {}).filter(
			(w): w is ClusterWorker => w != null,
		);

		if (workers.length === 0) {
			clusterLogger.info("No cluster workers to stop");
			process.exit(0);
			return;
		}

		let remaining = workers.length;
		const onWorkerExit = (): void => {
			remaining--;
			if (remaining <= 0) {
				clusterLogger.info("All workers stopped");
				process.exit(0);
			}
		};

		for (const w of workers) {
			w.once("exit", onWorkerExit);
			w.kill("SIGTERM");
		}

		// 子が固まった場合でもマスターは必ず落とす
		setTimeout(() => {
			clusterLogger.warn("Shutdown timeout (30s); exiting master");
			process.exit(0);
		}, 30_000);
	}

	process.once("SIGTERM", () => {
		beginShutdown("SIGTERM");
	});
	process.once("SIGINT", () => {
		beginShutdown("SIGINT");
	});
}

if (cluster.isPrimary && !envOption.disableClustering) {
	setupClusterPrimaryHandlers();
}

//#endregion クラスタ・プロセスイベント（プライマリ専用）

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
