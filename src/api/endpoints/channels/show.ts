/**
 * Module dependencies
 */
import $ from 'cafy';
import { default as Channel, IChannel } from '../../models/channel';
import serialize from '../../serializers/channel';

/**
 * Show a channel
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = (params, user) => new Promise(async (res, rej) => {
	// Get 'channel_id' parameter
	const [channelId, channelIdErr] = $(params.channel_id).id().$;
	if (channelIdErr) return rej('invalid channel_id param');

	// Fetch channel
	const channel: IChannel = await Channel.findOne({
		_id: channelId
	});

	if (channel === null) {
		return rej('channel not found');
	}

	// Serialize
	res(await serialize(channel, user));
});
