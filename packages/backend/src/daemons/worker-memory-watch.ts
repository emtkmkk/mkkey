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
 *   （増加量つき。何が増えているのか＝ヒープ内かヒープ外かを切り分けられる）、
 *   (2) Xev で `workerMemory` を流して master 側で集計できるようにする。
 * - **段階通知**: `STEP_MB` ごとの階段を上がったときだけログする。下がったら閾値も戻すので、
 *   膨張と回復が1往復につき数行に収まる。
 *
 * @see {@link daemons/health-stats} master 側の集計
 * @internal
 */
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

const toMb = (bytes: number): number => Math.round(bytes / 1048576);

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

	/** 直近に通知した段（MB）。0 は「まだ床を超えていない」 */
	let notifiedStepMb = 0;
	let prevRssMb = 0;
	let peakRssMb = 0;

	function tick(): void {
		const mem = process.memoryUsage();
		const rssMb = toMb(mem.rss);
		const heapUsedMb = toMb(mem.heapUsed);
		const heapTotalMb = toMb(mem.heapTotal);
		const externalMb = toMb(mem.external ?? 0);
		const arrayBuffersMb = toMb(mem.arrayBuffers ?? 0);
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
