import type Bull from "bull";
import type { QueueProcessorWrapper } from "@/queue/adaptive-queue-throttle.js";
import type { ObjectStorageJobData } from "@/queue/types.js";
import deleteFile from "./delete-file.js";
import cleanRemoteFiles from "./clean-remote-files.js";


const jobs = {
	deleteFile,
	cleanRemoteFiles,
} as Record<
	string,
	| Bull.ProcessCallbackFunction<ObjectStorageJobData>
	| Bull.ProcessPromiseFunction<ObjectStorageJobData>
>;

export default function (
	q: Bull.Queue,
	wrapProcessor?: QueueProcessorWrapper,
) {
	for (const [k, v] of Object.entries(jobs)) {
		const processor = wrapProcessor ? wrapProcessor("objectStorage", v as Bull.ProcessPromiseFunction<ObjectStorageJobData>) : v;
		q.process(k, 16, processor);
	}
}
