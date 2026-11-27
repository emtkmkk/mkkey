import type Bull from "bull";
import type { QueueProcessorWrapper } from "@/queue/adaptive-queue-throttle.js";
import { tickCharts } from "./tick-charts.js";
import { resyncCharts } from "./resync-charts.js";
import { cleanCharts } from "./clean-charts.js";
import { checkExpiredMutings } from "./check-expired-mutings.js";
import { clean } from "./clean.js";
import { cleanEmojis } from "./clean-emojis.js";
import { cleanReactions } from "./clean-reactions.js";
import { cleanAntennaNotes } from "./clean-antennaNote.js";
import { probeInstances } from "./probe-instances.js";
import {
	refreshStatsMvEmoji,
	refreshStatsMvFederationAndEmojiStats,
} from "./refresh-stats-mv.js";
import { warnInactiveDeletion } from "./warn-inactive-deletion.js";
import { sendUnreadSummaryEmail } from "./unread-summary-email.js";
import { broadcastPushNotice } from "./broadcast-push-notice.js";
import { executeScheduledAccountDeletions } from "./execute-scheduled-account-deletions.js";


const jobs = {
	tickCharts,
	resyncCharts,
	cleanCharts,
	checkExpiredMutings,
	clean,
	cleanEmojis,
	cleanReactions,
	cleanAntennaNotes,
	probeInstances,
	refreshStatsMvEmoji,
	refreshStatsMvFederationAndEmojiStats,
	warnInactiveDeletion,
	sendUnreadSummaryEmail,
	broadcastPushNotice,
	executeScheduledAccountDeletions,
} as Record<
	string,
	| Bull.ProcessCallbackFunction<Record<string, unknown>>
	| Bull.ProcessPromiseFunction<Record<string, unknown>>
>;

export default function (
	dbQueue: Bull.Queue<Record<string, unknown>>,
	wrapProcessor?: QueueProcessorWrapper,
) {
	for (const [k, v] of Object.entries(jobs)) {
		const processor = wrapProcessor ? wrapProcessor("system", v as Bull.ProcessPromiseFunction<Record<string, unknown>>) : v;
		dbQueue.process(k, processor);
	}
}
