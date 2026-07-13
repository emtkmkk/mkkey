import type httpSignature from "@peertube/http-signature";
import { v4 as uuid } from "uuid";

import config from "@/config/index.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { IActivity } from "@/remote/activitypub/type.js";
import type { Webhook, webhookEventTypes } from "@/models/entities/webhook.js";
import { envOption } from "../env.js";

import processDeliver from "./processors/deliver.js";
import processInbox from "./processors/inbox.js";
import processDb from "./processors/db/index.js";
import processObjectStorage from "./processors/object-storage/index.js";
import processSystemQueue from "./processors/system/index.js";
import processWebhookDeliver from "./processors/webhook-deliver.js";
import processBackground from "./processors/background/index.js";
import processNoteApDeliver from "./processors/note-ap-deliver.js";
import { endedPollNotification } from "./processors/ended-poll-notification.js";
import { deliverJobLogger, noteApDeliverLogger, queueLogger } from "./logger.js";
import { getJobInfo } from "./get-job-info.js";
import { clearDelayedRetry, markDelayedRetry } from "./delayed-retry-reason.js";
import { adaptiveQueueWrap } from "./adaptive-queue-throttle.js";

const DEFAULT_DELIVER_JOB_TIMEOUT_MS = 60 * 1000;
const DEFAULT_INBOX_JOB_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_JOB_TIMEOUT_MS = 1000;

/** deliver / noteApDeliver のジョブ timeout（ミリ秒）。未指定・異常値は既定に clamp。 */
function getDeliverJobTimeoutMs(): number {
	const ms = config.deliverJobTimeoutMs ?? DEFAULT_DELIVER_JOB_TIMEOUT_MS;
	return ms >= MIN_JOB_TIMEOUT_MS ? ms : DEFAULT_DELIVER_JOB_TIMEOUT_MS;
}

/** inbox のジョブ timeout（ミリ秒）。未指定・異常値は既定に clamp。 */
function getInboxJobTimeoutMs(): number {
	const ms = config.inboxJobTimeoutMs ?? DEFAULT_INBOX_JOB_TIMEOUT_MS;
	return ms >= MIN_JOB_TIMEOUT_MS ? ms : DEFAULT_INBOX_JOB_TIMEOUT_MS;
}
import {
	systemQueue,
	dbQueue,
	deliverQueue,
	inboxQueue,
	objectStorageQueue,
	endedPollNotificationQueue,
	webhookDeliverQueue,
	backgroundQueue,
	noteApDeliverQueue,
} from "./queues.js";
import type { NoteApDeliverJobData, ThinUser } from "./types.js";
import type { User } from "@/models/entities/user.js";

function renderError(e: Error): any {
	return {
		stack: e.stack,
		message: e.message,
		name: e.name,
	};
}

const systemLogger = queueLogger.createSubLogger("system");
const deliverLogger = deliverJobLogger;
const webhookLogger = queueLogger.createSubLogger("webhook");
const inboxLogger = queueLogger.createSubLogger("inbox");
const dbLogger = queueLogger.createSubLogger("db");
const objectStorageLogger = queueLogger.createSubLogger("objectStorage");

systemQueue
	.on("waiting", (jobId) => systemLogger.debug(`waiting id=${jobId}`))
	.on("active", (job) => systemLogger.debug(`active id=${job.id}`))
	.on("completed", (job, result) =>
		systemLogger.debug(`completed(${result}) id=${job.id}`),
	)
	.on("failed", (job, err) =>
		systemLogger.warn(`failed(${err}) id=${job.id}`, {
			job,
			e: renderError(err),
		}),
	)
	.on("error", (job: any, err: Error) =>
		systemLogger.error(`error ${err}`, { job, e: renderError(err) }),
	)
	.on("stalled", (job) => systemLogger.warn(`stalled id=${job.id}`));

deliverQueue
	.on("waiting", (jobId) => deliverLogger.debug(`waiting id=${jobId}`))
	.on("active", (job) => {
		clearDelayedRetry("deliver", job.id);
		deliverLogger.debug(`active ${getJobInfo(job, true)} to=${job.data.to}`);
	})
	.on("completed", (job, result) => {
		clearDelayedRetry("deliver", job.id);
		deliverLogger.debug(
			`completed(${result}) ${getJobInfo(job, true)} to=${job.data.to}`,
		);
	})
	.on("failed", (job, err) => {
		markDelayedRetry("deliver", job, err);
		deliverLogger.warn(`failed(${err}) ${getJobInfo(job)} to=${job.data.to}`);
	})
	.on("error", (job: any, err: Error) =>
		deliverLogger.error(`error ${err}`, { job, e: renderError(err) }),
	)
	.on("stalled", (job) =>
		deliverLogger.warn(`stalled ${getJobInfo(job)} to=${job.data.to}`),
	);

inboxQueue
	.on("waiting", (jobId) => inboxLogger.debug(`waiting id=${jobId}`))
	.on("active", (job) => {
		clearDelayedRetry("inbox", job.id);
		inboxLogger.debug(`active ${getJobInfo(job, true)}`);
	})
	.on("completed", (job, result) => {
		clearDelayedRetry("inbox", job.id);
		inboxLogger.debug(`completed(${result}) ${getJobInfo(job, true)}`);
	})
	.on("failed", (job, err) => {
		markDelayedRetry("inbox", job, err);
		inboxLogger.warn(
			`failed(${err}) ${getJobInfo(job)} activity=${
				job.data.activity ? job.data.activity.id : "none"
			}`,
			{ job, e: renderError(err) },
		);
	})
	.on("error", (job: any, err: Error) =>
		inboxLogger.error(`error ${err}`, { job, e: renderError(err) }),
	)
	.on("stalled", (job) =>
		inboxLogger.warn(
			`stalled ${getJobInfo(job)} activity=${
				job.data.activity ? job.data.activity.id : "none"
			}`,
		),
	);

dbQueue
	.on("waiting", (jobId) => dbLogger.debug(`waiting id=${jobId}`))
	.on("active", (job) => dbLogger.debug(`active id=${job.id}`))
	.on("completed", (job, result) =>
		dbLogger.debug(`completed(${result}) id=${job.id}`),
	)
	.on("failed", (job, err) =>
		dbLogger.warn(`failed(${err}) id=${job.id}`, { job, e: renderError(err) }),
	)
	.on("error", (job: any, err: Error) =>
		dbLogger.error(`error ${err}`, { job, e: renderError(err) }),
	)
	.on("stalled", (job) => dbLogger.warn(`stalled id=${job.id}`));

objectStorageQueue
	.on("waiting", (jobId) => objectStorageLogger.debug(`waiting id=${jobId}`))
	.on("active", (job) => objectStorageLogger.debug(`active id=${job.id}`))
	.on("completed", (job, result) =>
		objectStorageLogger.debug(`completed(${result}) id=${job.id}`),
	)
	.on("failed", (job, err) =>
		objectStorageLogger.warn(`failed(${err}) id=${job.id}`, {
			job,
			e: renderError(err),
		}),
	)
	.on("error", (job: any, err: Error) =>
		objectStorageLogger.error(`error ${err}`, { job, e: renderError(err) }),
	)
	.on("stalled", (job) => objectStorageLogger.warn(`stalled id=${job.id}`));

webhookDeliverQueue
	.on("waiting", (jobId) => webhookLogger.debug(`waiting id=${jobId}`))
	.on("active", (job) =>
		webhookLogger.debug(`active ${getJobInfo(job, true)} to=${job.data.to}`),
	)
	.on("completed", (job, result) =>
		webhookLogger.debug(
			`completed(${result}) ${getJobInfo(job, true)} to=${job.data.to}`,
		),
	)
	.on("failed", (job, err) =>
		webhookLogger.warn(`failed(${err}) ${getJobInfo(job)} to=${job.data.to}`),
	)
	.on("error", (job: any, err: Error) =>
		webhookLogger.error(`error ${err}`, { job, e: renderError(err) }),
	)
	.on("stalled", (job) =>
		webhookLogger.warn(`stalled ${getJobInfo(job)} to=${job.data.to}`),
	);

noteApDeliverQueue
	.on("waiting", (jobId) => noteApDeliverLogger.debug(`waiting id=${jobId}`))
	.on("active", (job) =>
		noteApDeliverLogger.debug(`active ${getJobInfo(job, true)}`),
	)
	.on("completed", (job, result) =>
		noteApDeliverLogger.debug(`completed(${result}) ${getJobInfo(job, true)}`),
	)
	.on("failed", (job, err) =>
		noteApDeliverLogger.warn(`failed(${err}) ${getJobInfo(job)}`),
	)
	.on("error", (job: any, err: Error) =>
		noteApDeliverLogger.error(`error ${err}`, { job, e: renderError(err) }),
	)
	.on("stalled", (job) =>
		noteApDeliverLogger.warn(`stalled ${getJobInfo(job)}`),
	);

export function deliver(
	user: ThinUser,
	content: unknown,
	to: string | null,
	isSharedInbox?: boolean,
) {
	if (content == null) return null;
	if (to == null) return null;

	const data = {
		user: {
			id: user.id,
		},
		content,
		to,
		isSharedInbox: isSharedInbox ?? false,
	};

	return deliverQueue.add(data, {
		attempts: config.deliverJobMaxAttempts || 12,
		timeout: getDeliverJobTimeoutMs(),
		backoff: {
			type: "apBackoff",
		},
		removeOnComplete: true,
		removeOnFail: true,
	});
}

export function inbox(
	activity: IActivity,
	signature: httpSignature.IParsedSignature,
	user?: ThinUser,
) {
	const data = {
		activity: activity,
		signature,
		user: user ?? undefined,
	};

	return inboxQueue.add(data, {
		attempts: config.inboxJobMaxAttempts || 8,
		timeout: getInboxJobTimeoutMs(),
		backoff: {
			type: "apBackoff",
		},
		removeOnComplete: true,
		removeOnFail: true,
	});
}

export function createDeleteDriveFilesJob(user: ThinUser) {
	return dbQueue.add(
		"deleteDriveFiles",
		{
			user: user,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createExportCustomEmojisJob(user: ThinUser) {
	return dbQueue.add(
		"exportCustomEmojis",
		{
			user: user,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createExportNotesJob(user: ThinUser) {
	return dbQueue.add(
		"exportNotes",
		{
			user: user,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createExportFollowingJob(
	user: ThinUser,
	excludeMuting = false,
	excludeInactive = false,
) {
	return dbQueue.add(
		"exportFollowing",
		{
			user: user,
			excludeMuting,
			excludeInactive,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createExportMuteJob(user: ThinUser) {
	return dbQueue.add(
		"exportMute",
		{
			user: user,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createExportBlockingJob(user: ThinUser) {
	return dbQueue.add(
		"exportBlocking",
		{
			user: user,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createExportUserListsJob(user: ThinUser) {
	return dbQueue.add(
		"exportUserLists",
		{
			user: user,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createImportFollowingJob(
	user: ThinUser,
	fileId: DriveFile["id"],
) {
	return dbQueue.add(
		"importFollowing",
		{
			user: user,
			fileId: fileId,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createImportPostsJob(
	user: ThinUser,
	fileId: DriveFile["id"],
	signatureCheck: boolean,
) {
	return dbQueue.add(
		"importPosts",
		{
			user: user,
			fileId: fileId,
			signatureCheck: signatureCheck,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createImportMutingJob(user: ThinUser, fileId: DriveFile["id"]) {
	return dbQueue.add(
		"importMuting",
		{
			user: user,
			fileId: fileId,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createImportBlockingJob(
	user: ThinUser,
	fileId: DriveFile["id"],
) {
	return dbQueue.add(
		"importBlocking",
		{
			user: user,
			fileId: fileId,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createImportUserListsJob(
	user: ThinUser,
	fileId: DriveFile["id"],
) {
	return dbQueue.add(
		"importUserLists",
		{
			user: user,
			fileId: fileId,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createImportCustomEmojisJob(
	user: ThinUser,
	fileId: DriveFile["id"],
) {
	return dbQueue.add(
		"importCustomEmojis",
		{
			user: user,
			fileId: fileId,
		},
	);
}

export function createDeleteAccountJob(
	user: ThinUser,
	opts: {
		soft?: boolean;
		followedDeletedNotifiedIds?: User["id"][];
	} = {},
) {
	return dbQueue.add(
		"deleteAccount",
		{
			user: user,
			soft: opts.soft,
			followedDeletedNotifiedIds: opts.followedDeletedNotifiedIds,
		},
		{
			removeOnComplete: true,
		},
	);
}

export function createDeleteObjectStorageFileJob(key: string) {
	return objectStorageQueue.add(
		"deleteFile",
		{
			key: key,
		},
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function createCleanRemoteFilesJob() {
	return objectStorageQueue.add(
		"cleanRemoteFiles",
		{},
		{
		},
	);
}

export function createIndexAllNotesJob(data = {}) {
	return backgroundQueue.add("indexAllNotes", data, {
		removeOnComplete: true,
		removeOnFail: true,
	});
}

export function createNoteApDeliverJob(data: NoteApDeliverJobData) {
	return noteApDeliverQueue.add(data, {
		attempts: config.deliverJobMaxAttempts || 12,
		timeout: getDeliverJobTimeoutMs(),
		backoff: {
			type: "apBackoff",
		},
		removeOnComplete: true,
		removeOnFail: true,
	});
}

export function webhookDeliver(
	webhook: Webhook,
	type: typeof webhookEventTypes[number],
	content: unknown,
) {
	const data = {
		type,
		content,
		webhookId: webhook.id,
		userId: webhook.userId,
		to: webhook.url,
		secret: webhook.secret,
		createdAt: Date.now(),
		eventId: uuid(),
	};

	return webhookDeliverQueue.add(data, {
		attempts: 4,
		timeout: 1 * 60 * 1000, // 1min
		backoff: {
			type: "apBackoff",
		},
		removeOnComplete: true,
		removeOnFail: true,
	});
}

export default function () {
	if (envOption.onlyServer) return;

	deliverQueue.process(
		config.deliverJobConcurrency || 128,
		adaptiveQueueWrap("deliver", processDeliver),
	);
	inboxQueue.process(
		config.inboxJobConcurrency || 16,
		adaptiveQueueWrap("inbox", processInbox),
	);
	endedPollNotificationQueue.process(endedPollNotification);
	webhookDeliverQueue.process(
		64,
		adaptiveQueueWrap("webhookDeliver", processWebhookDeliver),
	);
	noteApDeliverQueue.process(
		config.deliverJobConcurrency || 128,
		adaptiveQueueWrap("noteApDeliver", processNoteApDeliver),
	);
	processDb(dbQueue, adaptiveQueueWrap);
	processObjectStorage(objectStorageQueue, adaptiveQueueWrap);
	processBackground(backgroundQueue, adaptiveQueueWrap);

	systemQueue.add(
		"tickCharts",
		{},
		{
			repeat: { cron: "55 * * * *" },
			removeOnComplete: true,
		},
	);

	systemQueue.add(
		"resyncCharts",
		{},
		{
			repeat: { cron: "50 3 * * *" },
			removeOnComplete: true,
		},
	);

	systemQueue.add(
		"cleanCharts",
		{},
		{
			repeat: { cron: "50 3 * * *" },
			removeOnComplete: true,
		},
	);

	systemQueue.add(
		"clean",
		{},
		{
			attempts: 10,
			repeat: { cron: "50 3 * * *" },
			jobId: "clean",
		},
	);

	systemQueue.add(
		"checkExpiredMutings",
		{},
		{
			repeat: { cron: "*/5 * * * *" },
			removeOnComplete: true,
		},
	);

	systemQueue.add(
		"cleanEmojis",
		{},
		{
			repeat: { cron: "50 3 * * *" },
			jobId: "clean-emojis",
		},
	);

	systemQueue.add(
		"cleanReactions",
		{},
		{
			repeat: { cron: "0 15 * * *" },
			jobId: "clean-reactions",
		},
	);

	systemQueue.add(
		"cleanAntennaNotes",
		{},
		{
			repeat: { cron: "0 15 * * *" },
			jobId: "clean-antennanotes",
		},
	);

	systemQueue.add(
		"checkSuspendedInstances",
		{},
		{
			repeat: { cron: "0 4 * * *" },
			jobId: "check-suspended-instances",
		},
	);

	// 休眠アカウント（投稿1000以下・3ヶ月未活動）への自動削除予告メール（1日1回・JST 18時）
	// NOTE: cron/tz を変更すると旧設定の repeatable ジョブが Redis に残留して二重実行になるため、
	//       登録前に不一致エントリを掃除する。
	{
		const warnInactiveDeletionRepeat = {
			cron: "0 18 * * *",
			tz: "Asia/Tokyo",
		};
		void (async () => {
			try {
				const repeatableJobs = await systemQueue.getRepeatableJobs();
				for (const repeatable of repeatableJobs) {
					if (
						repeatable.name === "warnInactiveDeletion" &&
						(repeatable.cron !== warnInactiveDeletionRepeat.cron ||
							repeatable.tz !== warnInactiveDeletionRepeat.tz)
					) {
						await systemQueue.removeRepeatableByKey(repeatable.key);
						systemLogger.info(
							`Removed outdated repeatable job: ${repeatable.key}`,
						);
					}
				}
			} catch (err) {
				systemLogger.warn(
					`Failed to clean up outdated warnInactiveDeletion repeatable jobs: ${err}`,
				);
			}
			systemQueue.add(
				"warnInactiveDeletion",
				{},
				{
					repeat: warnInactiveDeletionRepeat,
					jobId: "warn-inactive-deletion",
				},
			);
		})();
	}

	systemQueue.add(
		"refreshStatsMvEmoji",
		{},
		{
			repeat: { cron: "17 * * * *" },
			removeOnComplete: true,
		},
	);

	systemQueue.add(
		"refreshStatsMvFederationAndEmojiStats",
		{},
		{
			repeat: { cron: "47 * * * *" },
			removeOnComplete: true,
		},
	);

	processSystemQueue(systemQueue, adaptiveQueueWrap);
}

export function destroy() {
	deliverQueue.once("cleaned", (jobs, status) => {
		deliverLogger.succ(`Cleaned ${jobs.length} ${status} jobs`);
	});
	deliverQueue.clean(0, "delayed");

	inboxQueue.once("cleaned", (jobs, status) => {
		inboxLogger.succ(`Cleaned ${jobs.length} ${status} jobs`);
	});
	inboxQueue.clean(0, "delayed");
}
