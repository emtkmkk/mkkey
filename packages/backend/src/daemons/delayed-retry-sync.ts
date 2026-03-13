/**
 * @packageDocumentation
 *
 * 遅延ジョブから遅延リトライ理由の状態を定期的に同期するデーモン。
 *
 * @remarks
 * - **役割**: deliver/inbox キューの遅延ジョブからリトライ理由を取得し、delayed-retry-reason の状態を同期する。
 *
 * @internal
 */
import { deliverQueue, inboxQueue } from "@/queue/queues.js";
import {
	getDelayedRetryPendingCounts,
	syncDelayedRetryStateFromJobs,
} from "@/queue/delayed-retry-reason.js";

const interval = 120000;

/**
 * 遅延ジョブから遅延リトライ理由の状態を定期的に同期する
 */
export default function () {
	let previousDelayed = {
		deliver: 0,
		inbox: 0,
	};
	let skipCount = 0;

	const sync = async (force = false): Promise<void> => {
		const deliverJobCounts = await deliverQueue.getJobCounts();
		const inboxJobCounts = await inboxQueue.getJobCounts();

		const delayed = {
			deliver: deliverJobCounts.delayed ?? 0,
			inbox: inboxJobCounts.delayed ?? 0,
		};
		const delayedTotal = delayed.deliver + delayed.inbox;
		const pending = getDelayedRetryPendingCounts();
		const hasPending = pending.deliver > 0 || pending.inbox > 0;
		const delayedChanged =
			delayed.deliver !== previousDelayed.deliver ||
			delayed.inbox !== previousDelayed.inbox;

		if (!force) {
			if (delayedTotal === 0 && !hasPending) {
				previousDelayed = delayed;
				skipCount = 0;
				return;
			}

			if (!hasPending && !delayedChanged) {
				skipCount++;
				if (skipCount < 3) {
					return;
				}
			}
		}

		const delayedDeliverJobs = delayed.deliver > 0 ? await deliverQueue.getJobs(["delayed"]) : [];
		const delayedInboxJobs = delayed.inbox > 0 ? await inboxQueue.getJobs(["delayed"]) : [];

		syncDelayedRetryStateFromJobs("deliver", delayedDeliverJobs);
		syncDelayedRetryStateFromJobs("inbox", delayedInboxJobs);

		previousDelayed = delayed;
		skipCount = 0;
	};

	void sync(true);
	setInterval(() => {
		void sync(false);
	}, interval);
}
