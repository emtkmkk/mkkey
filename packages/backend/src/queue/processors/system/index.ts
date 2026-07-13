import type Bull from "bull";
import { tickCharts } from "./tick-charts.js";
import { resyncCharts } from "./resync-charts.js";
import { cleanCharts } from "./clean-charts.js";
import { checkExpiredMutings } from "./check-expired-mutings.js";
import { clean } from "./clean.js";
import { cleanEmojis } from "./clean-emojis.js";
import { cleanReactions } from "./clean-reactions.js";
import { cleanAntennaNotes } from "./clean-antennaNote.js";
import { checkSuspendedInstances } from "./check-suspended-instances.js";
import {
	refreshStatsMvEmoji,
	refreshStatsMvFederationAndEmojiStats,
} from "./refresh-stats-mv.js";
import { warnInactiveDeletion } from "./warn-inactive-deletion.js";

type QueueProcessorWrapper = <T>(
	queueName: string,
	processor: Bull.ProcessPromiseFunction<T>,
) => Bull.ProcessPromiseFunction<T>;

const jobs = {
	tickCharts,
	resyncCharts,
	cleanCharts,
	checkExpiredMutings,
	clean,
	cleanEmojis,
	cleanReactions,
	cleanAntennaNotes,
	checkSuspendedInstances,
	refreshStatsMvEmoji,
	refreshStatsMvFederationAndEmojiStats,
	warnInactiveDeletion,
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
