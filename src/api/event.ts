import * as mongo from 'mongodb';
import * as redis from 'redis';
import config from '../conf';

type ID = string | mongo.ObjectID;

class MisskeyEvent {
	private redisClient: redis.RedisClient;

	constructor() {
		// Connect to Redis
		this.redisClient = redis.createClient(
			config.redis.port, config.redis.host);
	}

	public publishUserStream(userId: ID, type: string, value?: any): void {
		this.publish(`user-stream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishPostStream(postId: ID, type: string, value?: any): void {
		this.publish(`post-stream:${postId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishMessagingStream(userId: ID, otherpartyId: ID, type: string, value?: any): void {
		this.publish(`messaging-stream:${userId}-${otherpartyId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishMessagingIndexStream(userId: ID, type: string, value?: any): void {
		this.publish(`messaging-index-stream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishChannelStream(channelId: ID, type: string, value?: any): void {
		this.publish(`channel-stream:${channelId}`, type, typeof value === 'undefined' ? null : value);
	}

	private publish(channel: string, type: string, value?: any): void {
		const message = value == null ?
			{ type: type } :
			{ type: type, body: value };

		this.redisClient.publish(`misskey:${channel}`, JSON.stringify(message));
	}
}

const ev = new MisskeyEvent();

export default ev.publishUserStream.bind(ev);

export const publishPostStream = ev.publishPostStream.bind(ev);

export const publishMessagingStream = ev.publishMessagingStream.bind(ev);

export const publishMessagingIndexStream = ev.publishMessagingIndexStream.bind(ev);

export const publishChannelStream = ev.publishChannelStream.bind(ev);
