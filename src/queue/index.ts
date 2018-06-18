import { createQueue } from 'kue';

import config from '../config';
import http from './processors/http';
import { ILocalUser } from '../models/user';

const queue = createQueue({
	redis: {
		port: config.redis.port,
		host: config.redis.host,
		auth: config.redis.pass
	}
});

export function createHttp(data: any) {
	return queue
		.create('http', data)
		.removeOnComplete(true)
		.events(false)
		.attempts(8)
		.backoff({ delay: 16384, type: 'exponential' });
}

export function deliver(user: ILocalUser, content: any, to: any) {
	createHttp({
		title: 'deliver',
		type: 'deliver',
		user,
		content,
		to
	}).save();
}

export default function() {
	/*
		256 is the default concurrency limit of Mozilla Firefox and Google
		Chromium.
		a8af215e691f3a2205a3758d2d96e9d328e100ff - chromium/src.git - Git at Google
		https://chromium.googlesource.com/chromium/src.git/+/a8af215e691f3a2205a3758d2d96e9d328e100ff
		Network.http.max-connections - MozillaZine Knowledge Base
		http://kb.mozillazine.org/Network.http.max-connections
	*/
	//queue.process('http', 256, http);
	queue.process('http', 128, http);
}
