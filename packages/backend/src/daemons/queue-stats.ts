/**
 * @packageDocumentation
 *
 * キュー統計を定期的に報告するデーモン。
 *
 * @remarks
 * - **役割**: 定期的に deliver/inbox キュー等の統計を取得し、Xev で queueStats イベントを発火する。
 *
 * @internal
 */
import Xev from "xev";
import { getDelayedRetryReasonStats } from "../queue/delayed-retry-reason.js";
import { deliverQueue, inboxQueue } from "../queue/queues.js";

const ev = new Xev();

const interval = 10000;

/**
 * キューで最も長く待っているジョブの待機時間を返す。
 *
 * @remarks
 * Bull の waiting リスト先頭だけを取得するため、キュー全体の読み出しは行わない。
 * ジョブがなければ0を返す。
 *
 * @param queue - deliver または inbox キュー
 * @returns 最古ジョブの待機時間（ms）
 * @internal
 */
async function getOldestWaitingMs(
	queue: typeof deliverQueue | typeof inboxQueue,
): Promise<number> {
	const jobs = await queue.getWaiting(0, 0);
	const oldest = jobs[0];
	return oldest ? Math.max(0, Date.now() - oldest.timestamp) : 0;
}

/**
 * キュー統計を定期的に報告する
 */
export default function () {
	const log: unknown[] = [];

	ev.on("requestQueueStatsLog", (x) => {
		ev.emit(`queueStatsLog:${x.id}`, log.slice(0, x.length || 50));
	});

	let activeDeliverJobs = 0;
	let activeInboxJobs = 0;

	deliverQueue.on("global:active", () => {
		activeDeliverJobs++;
	});

	inboxQueue.on("global:active", () => {
		activeInboxJobs++;
	});

	async function tick() {
		const [
			deliverJobCounts,
			inboxJobCounts,
			deliverOldestWaitingMs,
			inboxOldestWaitingMs,
		] = await Promise.all([
			deliverQueue.getJobCounts(),
			inboxQueue.getJobCounts(),
			getOldestWaitingMs(deliverQueue),
			getOldestWaitingMs(inboxQueue),
		]);

		const delayedRetryReasonStats = getDelayedRetryReasonStats();

		const stats = {
			deliver: {
				activeSincePrevTick: activeDeliverJobs,
				active: deliverJobCounts.active,
				waiting: deliverJobCounts.waiting,
				oldestWaitingMs: deliverOldestWaitingMs,
				delayed: deliverJobCounts.delayed,
				delayedByReason: delayedRetryReasonStats.deliver,
			},
			inbox: {
				activeSincePrevTick: activeInboxJobs,
				active: inboxJobCounts.active,
				waiting: inboxJobCounts.waiting,
				oldestWaitingMs: inboxOldestWaitingMs,
				delayed: inboxJobCounts.delayed,
				delayedByReason: delayedRetryReasonStats.inbox,
			},
		};

		ev.emit("queueStats", stats);

		log.unshift(stats);
		if (log.length > 200) log.pop();

		activeDeliverJobs = 0;
		activeInboxJobs = 0;
	}

	tick();

	setInterval(tick, interval);
}
