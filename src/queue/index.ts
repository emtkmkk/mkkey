import * as Queue from 'bee-queue';
import config from '../config';
import http from './processors/http';
import { ILocalUser } from '../models/user';
import Logger from '../misc/logger';

const enableQueue = config.redis != null;

const queue = new Queue('misskey', {
	redis: {
		port: config.redis.port,
		host: config.redis.host,
		password: config.redis.pass
	},

	removeOnSuccess: true,
	removeOnFailure: true,
	getEvents: false,
	sendEvents: false,
	storeJobs: false
});

export function createHttpJob(data: any) {
	if (enableQueue) {
		return queue.createJob(data)
			.retries(4)
			.backoff('exponential', 16384) // 16s
			.save();
	} else {
		return http({ data }, () => {});
	}
}

export function deliver(user: ILocalUser, content: any, to: any) {
	if (content == null) return;

	createHttpJob({
		type: 'deliver',
		user,
		content,
		to
	});
}

export const queueLogger = new Logger('queue');

export default function() {
	if (enableQueue) {
		queue.process(128, http);
	}
}
