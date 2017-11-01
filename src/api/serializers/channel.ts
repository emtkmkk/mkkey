/**
 * Module dependencies
 */
import * as mongo from 'mongodb';
import deepcopy = require('deepcopy');
import { IUser } from '../models/user';
import { default as Channel, IChannel } from '../models/channel';
import Watching from '../models/channel-watching';

/**
 * Serialize a channel
 *
 * @param channel target
 * @param me? serializee
 * @return response
 */
export default (
	channel: string | mongo.ObjectID | IChannel,
	me?: string | mongo.ObjectID | IUser
) => new Promise<any>(async (resolve, reject) => {

	let _channel: any;

	// Populate the channel if 'channel' is ID
	if (mongo.ObjectID.prototype.isPrototypeOf(channel)) {
		_channel = await Channel.findOne({
			_id: channel
		});
	} else if (typeof channel === 'string') {
		_channel = await Channel.findOne({
			_id: new mongo.ObjectID(channel)
		});
	} else {
		_channel = deepcopy(channel);
	}

	// Rename _id to id
	_channel.id = _channel._id;
	delete _channel._id;

	// Remove needless properties
	delete _channel.user_id;

	// Me
	const meId: mongo.ObjectID = me
	? mongo.ObjectID.prototype.isPrototypeOf(me)
		? me as mongo.ObjectID
		: typeof me === 'string'
			? new mongo.ObjectID(me)
			: (me as IUser)._id
	: null;

	if (me) {
		//#region Watchしているかどうか
		const watch = await Watching.findOne({
			user_id: meId,
			channel_id: _channel.id,
			deleted_at: { $exists: false }
		});

		_channel.is_watching = watch !== null;
		//#endregion
	}

	resolve(_channel);
});
