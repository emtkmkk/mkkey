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
 * キュー統計を定期的に報告する
 */
export default function () {
	const log = [] as any[];

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
		const deliverJobCounts = await deliverQueue.getJobCounts();
		const inboxJobCounts = await inboxQueue.getJobCounts();

		const delayedRetryReasonStats = getDelayedRetryReasonStats();

		const stats = {
			deliver: {
				activeSincePrevTick: activeDeliverJobs,
				active: deliverJobCounts.active,
				waiting: deliverJobCounts.waiting,
				delayed: deliverJobCounts.delayed,
				delayedByReason: delayedRetryReasonStats.deliver,
			},
			inbox: {
				activeSincePrevTick: activeInboxJobs,
				active: inboxJobCounts.active,
				waiting: inboxJobCounts.waiting,
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
