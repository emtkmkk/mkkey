/**
 * Module dependencies
 */
import $ from 'cafy';
import User from '../../models/user';
import Post from '../../models/post';
import serialize from '../../serializers/user';

/**
 * Pin post
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = async (params, user) => new Promise(async (res, rej) => {
	// Get 'post_id' parameter
	const [postId, postIdErr] = $(params.post_id).id().$;
	if (postIdErr) return rej('invalid post_id param');

	// Fetch pinee
	const post = await Post.findOne({
		_id: postId,
		user_id: user._id
	});

	if (post === null) {
		return rej('post not found');
	}

	await User.update(user._id, {
		$set: {
			pinned_post_id: post._id
		}
	});

	// Serialize
	const iObj = await serialize(user, user, {
		detail: true
	});

	// Send response
	res(iObj);
});
