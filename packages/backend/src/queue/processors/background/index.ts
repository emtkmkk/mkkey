import type Bull from "bull";
import indexAllNotes from "./index-all-notes.js";

type QueueProcessorWrapper = <T>(
	queueName: string,
	processor: Bull.ProcessPromiseFunction<T>,
) => Bull.ProcessPromiseFunction<T>;

const jobs = {
	indexAllNotes,
} as Record<string, Bull.ProcessCallbackFunction<Record<string, unknown>>>;

export default function (
	q: Bull.Queue,
	wrapProcessor?: QueueProcessorWrapper,
) {
	for (const [k, v] of Object.entries(jobs)) {
		const processor = wrapProcessor ? wrapProcessor("background", v as Bull.ProcessPromiseFunction<Record<string, unknown>>) : v;
		q.process(k, 16, processor);
	}
}
