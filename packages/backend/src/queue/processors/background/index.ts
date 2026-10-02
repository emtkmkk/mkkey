/**
 * @packageDocumentation
 *
 * bg（バックグラウンド）キューのジョブの処理を登録する。
 *
 * @remarks
 * - 全ノートの検索インデックス作り（`indexAllNotes`）と、Bluesky ブリッジの follow / like の書き込み・削除を扱う。
 *
 * @internal
 */
import type Bull from "bull";
import indexAllNotes from "./index-all-notes.js";
import {
	type AtprotoRecordJobData,
	processFollowJob,
	processLikeJob,
	processUnfollowJob,
	processUnlikeJob,
} from "@/remote/atproto/records.js";

type QueueProcessorWrapper = <T>(
	queueName: string,
	processor: Bull.ProcessPromiseFunction<T>,
) => Bull.ProcessPromiseFunction<T>;

const jobs = {
	indexAllNotes,
} as Record<string, Bull.ProcessCallbackFunction<Record<string, unknown>>>;

/** Promise を返す形で書かれたジョブ（Bluesky ブリッジの follow / like の書き込み・削除。remote/atproto/records.ts） */
const promiseJobs: Record<string, Bull.ProcessPromiseFunction<AtprotoRecordJobData>> = {
	atprotoFollow: processFollowJob,
	atprotoUnfollow: processUnfollowJob,
	atprotoLike: processLikeJob,
	atprotoUnlike: processUnlikeJob,
};

export default function (
	q: Bull.Queue,
	wrapProcessor?: QueueProcessorWrapper,
) {
	for (const [k, v] of Object.entries(jobs)) {
		const processor = wrapProcessor ? wrapProcessor("background", v as Bull.ProcessPromiseFunction<Record<string, unknown>>) : v;
		q.process(k, 16, processor);
	}
	for (const [k, v] of Object.entries(promiseJobs)) {
		q.process(k, 16, wrapProcessor ? wrapProcessor("background", v) : v);
	}
}
