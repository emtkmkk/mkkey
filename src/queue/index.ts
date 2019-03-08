import * as Queue from 'bull';
import * as httpSignature from 'http-signature';

import config from '../config';
import { ILocalUser } from '../models/user';
import { program } from '../argv';

import processDeliver from './processors/deliver';
import processInbox from './processors/process-inbox';
import processDb from './processors/db';
import { queueLogger } from './logger';

function initializeQueue(name: string) {
	return new Queue(name, config.redis != null ? {
		redis: {
			port: config.redis.port,
			host: config.redis.host,
			password: config.redis.pass,
			db: 1
		}
	} : null);
}

export const deliverQueue = initializeQueue('deliver');
export const inboxQueue = initializeQueue('inbox');
export const dbQueue = initializeQueue('db');

deliverQueue
	.on('waiting', (jobId) => {
		queueLogger.debug(`[deliver] waiting id=${jobId}`);
	})
	.on('active', (job) => {
		queueLogger.debug(`[deliver] active id=${job.id} to=${job.data.to}`);
	})
	.on('completed', (job, result) => {
		queueLogger.debug(`[deliver] completed(${result}) id=${job.id} to=${job.data.to}`);
	})
	.on('failed', (job, err) => {
		queueLogger.debug(`[deliver] failed(${err}) id=${job.id} to=${job.data.to}`);
	})
	.on('error', (error) => {
		queueLogger.error(`[deliver] error ${error}`);
	})
	.on('stalled', (job) => {
		queueLogger.warn(`[deliver] stalled id=${job.id} to=${job.data.to}`);
	});

export function deliver(user: ILocalUser, content: any, to: any) {
	if (content == null) return null;

	const data = {
		user,
		content,
		to
	};

	return deliverQueue.add(data, {
		attempts: 8,
		backoff: {
			type: 'exponential',
			delay: 60 * 1000
		},
		removeOnComplete: true,
		removeOnFail: true
	});
}

export function inbox(activity: any, signature: httpSignature.IParsedSignature) {
	const data = {
		activity: activity,
		signature
	};

	return inboxQueue.add(data, {
		attempts: 8,
		backoff: {
			type: 'exponential',
			delay: 1000
		},
		removeOnComplete: true,
		removeOnFail: true
	});
}

export function createDeleteNotesJob(user: ILocalUser) {
	return dbQueue.add('deleteNotes', {
		user: user
	}, {
		removeOnComplete: true,
		removeOnFail: true
	});
}

export function createDeleteDriveFilesJob(user: ILocalUser) {
	return dbQueue.add('deleteDriveFiles', {
		user: user
	}, {
		removeOnComplete: true,
		removeOnFail: true
	});
}

export function createExportNotesJob(user: ILocalUser) {
	return dbQueue.add('exportNotes', {
		user: user
	}, {
		removeOnComplete: true,
		removeOnFail: true
	});
}

export function createExportFollowingJob(user: ILocalUser) {
	return dbQueue.add('exportFollowing', {
		user: user
	}, {
		removeOnComplete: true,
		removeOnFail: true
	});
}

export function createExportMuteJob(user: ILocalUser) {
	return dbQueue.add('exportMute', {
		user: user
	}, {
		removeOnComplete: true,
		removeOnFail: true
	});
}

export function createExportBlockingJob(user: ILocalUser) {
	return dbQueue.add('exportBlocking', {
		user: user
	}, {
		removeOnComplete: true,
		removeOnFail: true
	});
}

export default function() {
	if (!program.onlyServer) {
		deliverQueue.process(128, processDeliver);
		inboxQueue.process(128, processInbox);
		processDb(dbQueue);
	}
}

export function destroy() {
	deliverQueue.once('cleaned', (jobs, status) => {
		queueLogger.succ(`[deliver] Cleaned ${jobs.length} ${status} jobs`);
	});
	deliverQueue.clean(0, 'wait');

	inboxQueue.once('cleaned', (jobs, status) => {
		queueLogger.succ(`[inbox] Cleaned ${jobs.length} ${status} jobs`);
	});
	inboxQueue.clean(0, 'wait');
}
