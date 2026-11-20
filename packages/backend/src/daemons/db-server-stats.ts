/**
 * @packageDocumentation
 *
 * DB サーバの CPU・メモリ・swap・ネットワーク・ディスクを定期的に取得して配信するデーモン。
 *
 * @remarks
 * - **役割**: DB サーバで動く Prometheus の node_exporter から値を読み、前回との差から使用率などを計算して
 *   Xev の `dbServerStats` イベントで配信する。直近 200 件の履歴と、最新の静的な情報（総メモリなど）も持つ。
 * - **動く場所**: master プロセス。設定 `dbServerMetrics` があるときだけ {@link ../boot/master.ts} が起動する。
 * - **問い合わせ**: web ワーカーからは Xev で問い合わせる。
 *   - `requestDbServerStatsLog` → `dbServerStatsLog:<id>`（履歴。`dbServerStats` チャンネルが使う）
 *   - `requestDbServerInfo` → `dbServerInfo:<id>`（静的な情報。`db-server-info` API が使う）
 * - **方針**: DB サーバに負荷をかけないことを優先する。取得は 1 本ずつで、前回の取得が終わっていなければ次を飛ばす。
 *   失敗してもアプリ本体には影響させず、その回は配信しないだけにする。
 * - 計算は {@link ../misc/node-exporter-metrics.ts} に分けてある（テストしやすくするため）。
 * - NB: 送り先はプライベート IP を想定しているので、SSRF 対策のある共通 fetch（misc/fetch.ts）は使わず
 *   `node:http` で直接取りに行く。送り先は設定ファイルの値だけで、ユーザーの入力は使わない。
 *
 * @internal
 */
import * as http from "node:http";
import * as https from "node:https";
import { performance } from "node:perf_hooks";
import Xev from "xev";
import Logger from "@/services/logger.js";
import type { Config } from "@/config/types.js";
import { parsePrometheusText } from "@/misc/prometheus-text.js";
import {
	computeDbServerStats,
	nodeExporterMetricNames,
	toDbServerInfo,
	toNodeExporterSnapshot,
} from "@/misc/node-exporter-metrics.js";
import type {
	DbServerInfo,
	DbServerStats,
	NodeExporterSnapshot,
} from "@/misc/node-exporter-metrics.js";

const logger = new Logger("db-server-stats");

const ev = new Xev();

// #region 定数

/** 取得間隔の既定値（ミリ秒） */
const defaultInterval = 5000;
/** 取得間隔の下限（ミリ秒）。短くしすぎて DB サーバに負荷をかけないため */
const minInterval = 2000;
/** 1 回の取得の打ち切り時間（ミリ秒） */
const requestTimeoutMs = 2000;
/** 応答本文の上限（バイト）。収集項目を絞った node_exporter なら数十 KB に収まる */
const maxResponseBytes = 4 * 1024 * 1024;
/** 何回続けて失敗したら警告を出し、静的な情報を「不明」に戻すか */
const failureThreshold = 3;
/** 保持する履歴の件数（serverStats と同じ） */
const logLength = 200;

// #endregion

/**
 * DB サーバのメトリクスの取得を開始する。
 *
 * @param settings - 設定ファイルの `dbServerMetrics`。`url` が無ければ何もしない
 * @returns 戻り値なし
 * @internal
 */
export default function (settings: Config["dbServerMetrics"]): void {
	if (!settings?.url) return;

	const url = new URL(settings.url);
	const interval = Math.max(minInterval, settings.interval ?? defaultInterval);
	const cpuModel = settings.cpuModel ?? "";
	const targets = {
		networkDevice: settings.networkDevice,
		diskDevice: settings.diskDevice,
		mountpoint: settings.mountpoint,
	};
	// 毎回の TCP 接続を避けるため、1 本だけ使い回す
	const agent =
		url.protocol === "https:"
			? new https.Agent({ keepAlive: true, maxSockets: 1 })
			: new http.Agent({ keepAlive: true, maxSockets: 1 });

	const log: DbServerStats[] = [];
	let prev: NodeExporterSnapshot | null = null;
	let latestInfo: DbServerInfo | null = null;
	let consecutiveFailures = 0;
	let isRunning = false;

	ev.on("requestDbServerStatsLog", (x) => {
		ev.emit(`dbServerStatsLog:${x.id}`, log.slice(0, x.length || 50));
	});

	ev.on("requestDbServerInfo", (x) => {
		ev.emit(`dbServerInfo:${x.id}`, latestInfo);
	});

	/** 1 回ぶん取得し、計算できれば配信する。 */
	async function tick(): Promise<void> {
		// 前回の取得が終わっていなければ重ねない（DB サーバ側の負荷を増やさないため）
		if (isRunning) return;
		isRunning = true;
		try {
			const text = await fetchText(url, agent);
			// 経過時間は OS 時計の補正の影響を受けない単調な時計で測る
			const cur = toNodeExporterSnapshot(
				parsePrometheusText(text, nodeExporterMetricNames),
				performance.now(),
				targets,
			);

			if (consecutiveFailures >= failureThreshold) {
				logger.info("DB サーバのメトリクスを再び取得できるようになりました");
			}
			consecutiveFailures = 0;
			latestInfo = toDbServerInfo(cur, cpuModel);

			const stats = prev ? computeDbServerStats(prev, cur) : null;
			prev = cur;
			if (stats == null) return;

			ev.emit("dbServerStats", stats);
			log.unshift(stats);
			if (log.length > logLength) log.pop();
		} catch (e) {
			consecutiveFailures++;
			// 失敗が続いても警告は 1 回だけにする（ログを大量に出さないため）
			if (consecutiveFailures === failureThreshold) {
				logger.warn(
					`DB サーバのメトリクスを ${failureThreshold} 回続けて取得できませんでした: ${
						e instanceof Error ? e.message : String(e)
					}`,
				);
				// 古い静的な情報を見せ続けないよう、不明に戻す
				latestInfo = null;
			}
		} finally {
			isRunning = false;
		}
	}

	tick();
	setInterval(tick, interval);
}

/**
 * node_exporter の応答本文を文字列で取得する。
 *
 * @remarks
 * - {@link requestTimeoutMs} を過ぎたら打ち切る（接続待ちと受信の両方を含めた時間）。
 * - 本文が {@link maxResponseBytes} を超えたら打ち切る。設定の誤りで巨大な応答を受け取らないため。
 * - リダイレクトはたどらない。
 *
 * @param url - 取得先
 * @param agent - 使い回す接続
 * @returns 応答本文
 * @throws Error - 200 以外の応答、タイムアウト、本文が大きすぎる、通信エラーのとき
 * @internal
 */
function fetchText(url: URL, agent: http.Agent): Promise<string> {
	return new Promise((resolve, reject) => {
		const client = url.protocol === "https:" ? https : http;
		const req = client.get(
			url,
			{ agent, headers: { Accept: "text/plain" } },
			(res) => {
				if (res.statusCode !== 200) {
					// 本文を読み捨てて接続を使い回せるようにする
					res.resume();
					clearTimeout(timer);
					reject(new Error(`HTTP ${res.statusCode}`));
					return;
				}
				const chunks: Buffer[] = [];
				let size = 0;
				res.on("data", (chunk: Buffer) => {
					size += chunk.length;
					if (size > maxResponseBytes) {
						req.destroy(new Error("response too large"));
						return;
					}
					chunks.push(chunk);
				});
				res.on("end", () => {
					clearTimeout(timer);
					resolve(Buffer.concat(chunks).toString("utf8"));
				});
				res.on("error", (e) => {
					clearTimeout(timer);
					reject(e);
				});
			},
		);
		const timer = setTimeout(() => {
			req.destroy(new Error("timeout"));
		}, requestTimeoutMs);
		req.on("error", (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}
