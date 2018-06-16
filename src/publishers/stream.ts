import * as mongo from 'mongodb';
import * as redis from 'redis';
import config from '../config';

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

	public publishDriveStream(userId: ID, type: string, value?: any): void {
		this.publish(`drive-stream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishNoteStream(noteId: ID, type: string, value?: any): void {
		this.publish(`note-stream:${noteId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishUserListStream(listId: ID, type: string, value?: any): void {
		this.publish(`user-list-stream:${listId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishMessagingStream(userId: ID, otherpartyId: ID, type: string, value?: any): void {
		this.publish(`messaging-stream:${userId}-${otherpartyId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishMessagingIndexStream(userId: ID, type: string, value?: any): void {
		this.publish(`messaging-index-stream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishReversiStream(userId: ID, type: string, value?: any): void {
		this.publish(`reversi-stream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishReversiGameStream(gameId: ID, type: string, value?: any): void {
		this.publish(`reversi-game-stream:${gameId}`, type, typeof value === 'undefined' ? null : value);
	}

	public publishLocalTimelineStream(note: any): void {
		this.redisClient.publish('misskey:local-timeline', JSON.stringify(note));
	}

	public publishGlobalTimelineStream(note: any): void {
		this.redisClient.publish('misskey:global-timeline', JSON.stringify(note));
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

export const publishLocalTimelineStream = ev.publishLocalTimelineStream.bind(ev);
export const publishGlobalTimelineStream = ev.publishGlobalTimelineStream.bind(ev);
export const publishDriveStream = ev.publishDriveStream.bind(ev);
export const publishUserListStream = ev.publishUserListStream.bind(ev);
export const publishNoteStream = ev.publishNoteStream.bind(ev);
export const publishMessagingStream = ev.publishMessagingStream.bind(ev);
export const publishMessagingIndexStream = ev.publishMessagingIndexStream.bind(ev);
export const publishReversiStream = ev.publishReversiStream.bind(ev);
export const publishReversiGameStream = ev.publishReversiGameStream.bind(ev);
