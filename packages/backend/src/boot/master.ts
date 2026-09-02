/**
 * @packageDocumentation
 *
 * マスタープロセスの起動。設定読み込み・DB 接続・ワーカー起動・環境表示を行う。
 *
 * @remarks
 * - **役割**: クラスタの master で実行。loadConfig・initDb 後に worker を fork。起動時メタ情報を表示。
 *
 * @see {@link boot/index} ブートエントリ
 * @see {@link worker} ワーカー
 * @internal
 */
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import * as os from "node:os";
import cluster from "node:cluster";
import chalk from "chalk";
import chalkTemplate from "chalk-template";
import semver from "semver";

import Logger from "@/services/logger.js";
import loadConfig from "@/config/load.js";
import type { Config } from "@/config/types.js";
import { envOption } from "../env.js";
import { showMachineInfo } from "@/misc/show-machine-info.js";
import { db, initDb } from "../db/postgre.js";
import { registerWorker } from "./worker-registry.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

const meta = JSON.parse(
	fs.readFileSync(`${_dirname}/../../../../built/meta.json`, "utf-8"),
);

const logger = new Logger("core", "cyan");
const bootLogger = logger.createSubLogger("boot", "magenta", false);

const themeColor = chalk.hex("#31748f");

function greet() {
	if (!envOption.quiet) {
		bootLogger.info("Cluckeyは、オープンソース分散型マイクロブログプラットフォームです。");
		bootLogger.info(chalkTemplate`--- ${os.hostname()} {gray (PID: ${process.pid.toString()})} ---`);
	}

	bootLogger.info("Welcome to Cluckey!");
	bootLogger.info(
		`Cluckey v${meta.version}+${process.env.COMMIT_HASH}`,
		null,
		true,
	);
}

/**
 * マスタープロセスを初期化する。設定読み込み・DB 接続・ワーカー起動まで行う。
 * @internal
 */
export async function masterMain() {
	let config!: Config;

	// アプリ初期化
	try {
		greet();
		showEnvironment();
		await showMachineInfo(bootLogger);
		showNodejsVersion();
		config = loadConfigBoot();
		await connectDb();
	} catch (e) {
		bootLogger.error(
			`Fatal error occurred during initialization: ${e}`,
			null,
			true,
		);
		process.exit(1);
	}

	bootLogger.succ("Calckey initialized");

	if (!envOption.disableClustering) {
		const cl = config.clusterLimits;
		if (cl?.web == null || cl?.queue == null) {
			bootLogger.error("clusterLimits.web and clusterLimits.queue are required", null, true);
			process.exit(1);
		}
		await spawnWorkers({ web: cl.web, queue: cl.queue, proxy: cl.proxy });
	}

	bootLogger.succ(
		`Now listening on port ${config.port} on ${config.url}`,
		null,
		true,
	);

	if (
		!envOption.noDaemons &&
		config.clusterLimits?.web &&
		config.clusterLimits?.web >= 1
	) {
		import("../daemons/server-stats.js").then((x) => x.default());
		import("../daemons/queue-stats.js").then((x) => x.default());
		import("../daemons/delayed-retry-sync.js").then((x) => x.default());
		import("../daemons/health-stats.js").then((x) => x.default());
		import("../daemons/janitor.js").then((x) => x.default());
	}
}

function showEnvironment(): void {
	const env = process.env.NODE_ENV;
	const logger = bootLogger.createSubLogger("env");
	logger.info(
		typeof env === "undefined" ? "NODE_ENV is not set" : `NODE_ENV: ${env}`,
	);

	if (env !== "production") {
		logger.warn("The environment is not in production mode.");
		logger.warn("DO NOT USE THIS IN PRODUCTION!", null, true);
	}
}

function showNodejsVersion(): void {
	const nodejsLogger = bootLogger.createSubLogger("nodejs");

	nodejsLogger.info(`Version ${process.version} detected.`);

	const minVersion = fs
		.readFileSync(`${_dirname}/../../../../.node-version`, "utf-8")
		.trim();
	if (semver.lt(process.version, minVersion)) {
		nodejsLogger.error(`At least Node.js ${minVersion} required!`);
		process.exit(1);
	}
}

function loadConfigBoot(): Config {
	const configLogger = bootLogger.createSubLogger("config");
	let config;

	try {
		config = loadConfig();
	} catch (exception: unknown) {
		const err = exception as NodeJS.ErrnoException;
		if (err && err.code === "ENOENT") {
			configLogger.error("Configuration file not found", null, true);
			process.exit(1);
		} else if (exception instanceof Error) {
			configLogger.error(exception.message);
			process.exit(1);
		}
		throw exception;
	}

	configLogger.succ("Loaded");

	return config;
}

async function connectDb(): Promise<void> {
	const dbLogger = bootLogger.createSubLogger("db");

	// Try to connect to DB
	try {
		dbLogger.info("Connecting...");
		await initDb();
		const v = await db
			.query("SHOW server_version")
			.then((x) => x[0].server_version);
		dbLogger.succ(`Connected: v${v}`);
	} catch (e: unknown) {
		dbLogger.error("Cannot connect", null, true);
		dbLogger.error(e instanceof Error ? e : String(e));
		process.exit(1);
	}
}

/** load 済みの clusterLimits（web/queue は必須） */
type ResolvedClusterLimits = { web: number; queue: number; proxy?: number };

async function spawnWorkers(clusterLimits: ResolvedClusterLimits): Promise<void> {
	const modes = ["web", "queue"] as const;
	const cpus = os.cpus().length;
	for (const mode of modes.filter((mode) => clusterLimits[mode] > cpus)) {
		bootLogger.warn(
			`configuration warning: cluster limit for ${mode} exceeds number of cores (${cpus})`,
		);
	}

	const total = modes.reduce((acc, mode) => acc + clusterLimits[mode], 0);
	const workers = new Array<"web" | "queue" | "proxyweb">(total);
	const proxyClusterLimit = clusterLimits.proxy ?? 1;

	workers.fill("proxyweb", 0, proxyClusterLimit);
	workers.fill("web", proxyClusterLimit, clusterLimits.web);
	workers.fill("queue", clusterLimits.web);

	bootLogger.info(
		`Starting ${clusterLimits.web} web workers and ${clusterLimits.queue} queue workers (total ${total})...`,
	);
	await Promise.all(
		workers.map((mode, index) => spawnWorker(mode, `${index}`)),
	);
	bootLogger.succ("All workers started");
}

function spawnWorker(mode: "web" | "queue" | "proxyweb", index = "?"): Promise<void> {
	// "proxyweb" は web の一種。ここで実際に渡す mode / proxy に解決しておく
	// （let を書き換えるとクロージャ内で型が広がるため const で確定させる）
	const proxy = mode === "proxyweb" ? "1" : "0";
	const resolvedMode: "web" | "queue" = mode === "proxyweb" ? "web" : mode;
	return new Promise((res) => {
		const worker = cluster.fork({ mode: resolvedMode, index, proxy });
		// worker.process から env は読めないため、役割はプライマリ側で覚えておく
		registerWorker(worker.id, { mode: resolvedMode, index, proxy });
		worker.on("message", (message) => {
			if (message === "listenFailed") {
				bootLogger.error("The server listen failed due to the previous error.");
				process.exit(1);
			}
			if (message !== "ready") return;
			res();
		});
	});
}
