import * as websocket from 'websocket';
import * as redis from 'redis';
import * as debug from 'debug';

import User, { IUser } from '../../../models/user';
import Mute from '../../../models/mute';
import { pack as packNote, pack } from '../../../models/note';
import readNotification from '../common/read-notification';
import call from '../call';
import { IApp } from '../../../models/app';

const log = debug('misskey');

export default async function(
	request: websocket.request,
	connection: websocket.connection,
	subscriber: redis.RedisClient,
	user: IUser,
	app: IApp
) {
	// Subscribe Home stream channel
	subscriber.subscribe(`misskey:user-stream:${user._id}`);

	const mute = await Mute.find({ muterId: user._id });
	const mutedUserIds = mute.map(m => m.muteeId.toString());

	subscriber.on('message', async (channel, data) => {
		switch (channel.split(':')[1]) {
			case 'user-stream':
				try {
					const x = JSON.parse(data);

					//#region 流れてきたメッセージがミュートしているユーザーが関わるものだったら無視する
					if (x.type == 'note') {
						if (mutedUserIds.includes(x.body.userId)) {
							return;
						}
						if (x.body.reply != null && mutedUserIds.includes(x.body.reply.userId)) {
							return;
						}
						if (x.body.renote != null && mutedUserIds.includes(x.body.renote.userId)) {
							return;
						}
					} else if (x.type == 'notification') {
						if (mutedUserIds.includes(x.body.userId)) {
							return;
						}
					}
					//#endregion

					// Renoteなら再pack
					if (x.type == 'note' && x.body.renoteId != null) {
						x.body.renote = await pack(x.body.renoteId, user, {
							detail: true
						});
						data = JSON.stringify(x);
					}

					connection.send(data);
				} catch (e) {
					connection.send(data);
				}
				break;

			case 'note-stream':
				const noteId = channel.split(':')[2];
				log(`RECEIVED: ${noteId} ${data} by @${user.username}`);
				const note = await packNote(noteId, user, {
					detail: true
				});
				connection.send(JSON.stringify({
					type: 'note-updated',
					body: {
						note: note
					}
				}));
				break;
		}
	});

	connection.on('message', async data => {
		const msg = JSON.parse(data.utf8Data);

		switch (msg.type) {
			case 'api':
				// 新鮮なデータを利用するためにユーザーをフェッチ
				call(msg.endpoint, await User.findOne({ _id: user._id }), app, msg.data).then(res => {
					connection.send(JSON.stringify({
						type: `api-res:${msg.id}`,
						body: { res }
					}));
				}).catch(e => {
					connection.send(JSON.stringify({
						type: `api-res:${msg.id}`,
						body: { e }
					}));
				});
				break;

			case 'alive':
				// Update lastUsedAt
				User.update({ _id: user._id }, {
					$set: {
						'lastUsedAt': new Date()
					}
				});
				break;

			case 'read_notification':
				if (!msg.id) return;
				readNotification(user._id, msg.id);
				break;

			case 'capture':
				if (!msg.id) return;
				const noteId = msg.id;
				log(`CAPTURE: ${noteId} by @${user.username}`);
				subscriber.subscribe(`misskey:note-stream:${noteId}`);
				break;
		}
	});
}
