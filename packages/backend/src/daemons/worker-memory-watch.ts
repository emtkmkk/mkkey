/**
 * @packageDocumentation
 *
 * ワーカープロセス自身のメモリを監視し、段階的に警告ログを出して master へ報告するデーモン。
 *
 * @remarks
 * - **なぜ必要か**: {@link daemons/health-stats} の `heapStats` は master プロセスの
 *   `process.memoryUsage()` しか見ていない。実際にリクエストを捌く web ワーカーが
 *   膨張しても master は平常値のままで、記録に何も残らなかった。
 * - **やること**: 各ワーカーで定期サンプリングし、(1) RSS が段になるたびに WARN を出す
 *   （増加量つき。ヒープ内かヒープ外かを切り分けられる）、
 *   (2) Xev で `workerMemory` を流して master 側で集計できるようにする。
 * - **段階通知**: `STEP_MB` ごとの階段を上がったときだけログする。下がったら閾値も戻すので、
 *   膨張と回復が1往復につき数行に収まる。
 * - **RSS の取得元**: `/proc/self/statm` を優先する。本番で
 *   `process.memoryUsage().rss` が実際の RSS と桁違いの値を返す事象を観測したため
 *   （`heapUsed` 等は正常だった）。`/proc` が読めない環境では `memoryUsage()` に落ちる。
 *   どちらの経路でも、物理メモリ量から見て有り得ない値はサンプルごと捨てる。
 *
 * @see {@link daemons/health-stats} master 側の集計
 * @internal
 */
import fs from "node:fs";
import os from "node:os";
import Xev from "xev";
import Logger from "@/services/logger.js";

const ev = new Xev();
const logger = new Logger("worker-memory", "yellow");

/** サンプリング間隔（ms）。膨張が数秒で進むため短めに取る。 */
const SAMPLE_INTERVAL_MS = 5_000;
/** この RSS を超えてから段階通知を始める（MB）。通常運用値より十分上に置く。 */
const WARN_FLOOR_MB = 600;
/** 何 MB 上がるごとに通知するか。 */
const STEP_MB = 250;
/** 物理メモリの何倍までを「有り得る RSS」とみなすか（スワップ込みでも超えない値）。 */
const SANITY_FACTOR = 2;

const toMb = (bytes: number): number => Math.round(bytes / 1048576);

/**
 * `/proc/self/statm` から RSS をバイト単位で読む。
 *
 * @returns RSS（バイト）。読めない・解釈できない場合は null
 * @internal
 */
function readProcRssBytes(): number | null {
	try {
		// statm: size resident shared text lib data dt （単位はページ）
		const fields = fs.readFileSync("/proc/self/statm", "utf8").split(" ");
		const residentPages = Number(fields[1]);
		if (!Number.isFinite(residentPages) || residentPages <= 0) return null;
		return residentPages * 4096;
	} catch {
		// Linux 以外、または /proc が無い環境
		return null;
	}
}

/**
 * ワーカーのメモリ監視を開始する。
 *
 * @remarks
 * ワーカープロセスでのみ呼ぶこと。master では {@link daemons/health-stats} が担当する。
 * @internal
 */
export default function (): void {
	const index = process.env.index ?? "?";
	const mode = process.env.mode ?? "?";
	const sanityCeilingBytes = os.totalmem() * SANITY_FACTOR;

	/** 直近に通知した段（MB）。0 は「まだ床を超えていない」 */
	let notifiedStepMb = 0;
	let prevRssMb = 0;
	let peakRssMb = 0;
	/** `memoryUsage().rss` と `/proc` の食い違いは一度だけ報告する */
	let reportedRssMismatch = false;
	/** 異常値を捨てたことも一度だけ報告する */
	let reportedInsaneRss = false;

	function tick(): void {
		const mem = process.memoryUsage();
		const heapUsedMb = toMb(mem.heapUsed);
		const heapTotalMb = toMb(mem.heapTotal);
		const externalMb = toMb(mem.external ?? 0);
		const arrayBuffersMb = toMb(mem.arrayBuffers ?? 0);

		const procRssBytes = readProcRssBytes();
		const rssBytes = procRssBytes ?? mem.rss;

		// 有り得ない値はこのサンプルごと捨てる（誤検知でインシデントを汚さない）
		if (!Number.isFinite(rssBytes) || rssBytes <= 0 || rssBytes > sanityCeilingBytes) {
			if (!reportedInsaneRss) {
				reportedInsaneRss = true;
				logger.warn(
					`worker ${mode}<${index}> got an implausible RSS and is skipping samples: proc=${procRssBytes} memoryUsage=${mem.rss} totalmem=${os.totalmem()}`,
				);
			}
			return;
		}

		// 取得経路の食い違いを一度だけ記録しておく（原因調査用）
		if (
			!reportedRssMismatch &&
			procRssBytes != null &&
			Math.abs(procRssBytes - mem.rss) > procRssBytes * 0.5
		) {
			reportedRssMismatch = true;
			logger.warn(
				`worker ${mode}<${index}> RSS source mismatch: /proc=${procRssBytes} memoryUsage().rss=${mem.rss} (using /proc)`,
			);
		}

		const rssMb = toMb(rssBytes);
		const deltaMb = prevRssMb === 0 ? 0 : rssMb - prevRssMb;
		if (rssMb > peakRssMb) peakRssMb = rssMb;

		// master 側の集計用。受け手が居なくても害はない。
		ev.emit("workerMemory", {
			index,
			mode,
			pid: process.pid,
			rssMb,
			heapUsedMb,
			heapTotalMb,
			externalMb,
			arrayBuffersMb,
			peakRssMb,
			at: Date.now(),
		});

		if (rssMb >= WARN_FLOOR_MB) {
			// 床を超えていれば、そこから STEP_MB ごとの段に丸める
			const step =
				WARN_FLOOR_MB +
				Math.floor((rssMb - WARN_FLOOR_MB) / STEP_MB) * STEP_MB;
			if (step > notifiedStepMb) {
				notifiedStepMb = step;
				logger.warn(
					`worker ${mode}<${index}> memory rising: rss=${rssMb}MB (+${deltaMb}MB/${
						SAMPLE_INTERVAL_MS / 1000
					}s) heapUsed=${heapUsedMb}MB heapTotal=${heapTotalMb}MB external=${externalMb}MB arrayBuffers=${arrayBuffersMb}MB peak=${peakRssMb}MB`,
				);
			}
		} else if (notifiedStepMb > 0) {
			logger.info(
				`worker ${mode}<${index}> memory recovered: rss=${rssMb}MB (peak was ${peakRssMb}MB)`,
			);
			notifiedStepMb = 0;
		}

		prevRssMb = rssMb;
	}

	tick();
	const timer = setInterval(tick, SAMPLE_INTERVAL_MS);
	// 監視のためにプロセスを生かし続けない
	timer.unref?.();
}
