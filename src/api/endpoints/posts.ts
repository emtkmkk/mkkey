/**
 * Module dependencies
 */
import $ from 'cafy';
import Post from '../models/post';
import serialize from '../serializers/post';

/**
 * Lists all posts
 *
 * @param {any} params
 * @return {Promise<any>}
 */
module.exports = (params) => new Promise(async (res, rej) => {
	// Get 'reply' parameter
	const [reply, replyErr] = $(params.reply).optional.boolean().$;
	if (replyErr) return rej('invalid reply param');

	// Get 'repost' parameter
	const [repost, repostErr] = $(params.repost).optional.boolean().$;
	if (repostErr) return rej('invalid repost param');

	// Get 'media' parameter
	const [media, mediaErr] = $(params.media).optional.boolean().$;
	if (mediaErr) return rej('invalid media param');

	// Get 'poll' parameter
	const [poll, pollErr] = $(params.poll).optional.boolean().$;
	if (pollErr) return rej('invalid poll param');

	// Get 'limit' parameter
	const [limit = 10, limitErr] = $(params.limit).optional.number().range(1, 100).$;
	if (limitErr) return rej('invalid limit param');

	// Get 'since_id' parameter
	const [sinceId, sinceIdErr] = $(params.since_id).optional.id().$;
	if (sinceIdErr) return rej('invalid since_id param');

	// Get 'max_id' parameter
	const [maxId, maxIdErr] = $(params.max_id).optional.id().$;
	if (maxIdErr) return rej('invalid max_id param');

	// Check if both of since_id and max_id is specified
	if (sinceId && maxId) {
		return rej('cannot set since_id and max_id');
	}

	// Construct query
	const sort = {
		_id: -1
	};
	const query = {} as any;
	if (sinceId) {
		sort._id = 1;
		query._id = {
			$gt: sinceId
		};
	} else if (maxId) {
		query._id = {
			$lt: maxId
		};
	}

	if (reply != undefined) {
		query.reply_id = reply ? { $exists: true, $ne: null } : null;
	}

	if (repost != undefined) {
		query.repost_id = repost ? { $exists: true, $ne: null } : null;
	}

	if (media != undefined) {
		query.media_ids = media ? { $exists: true, $ne: null } : null;
	}

	if (poll != undefined) {
		query.poll = poll ? { $exists: true, $ne: null } : null;
	}

	// Issue query
	const posts = await Post
		.find(query, {
			limit: limit,
			sort: sort
		});

	// Serialize
	res(await Promise.all(posts.map(async post => await serialize(post))));
});
