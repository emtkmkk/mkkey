import $ from 'cafy'; import ID from '../../../../cafy-id';
import Note from '../../../../models/note';
import User from '../../../../models/user';
import Mute from '../../../../models/mute';
import { getFriendIds } from '../../common/get-friends';
import { pack } from '../../../../models/note';

/**
 * Search notes by tag
 */
module.exports = (params, me) => new Promise(async (res, rej) => {
	// Get 'tag' parameter
	const [tag, tagError] = $.str.get(params.tag);
	if (tagError) return rej('invalid tag param');

	// Get 'includeUserIds' parameter
	const [includeUserIds = [], includeUserIdsErr] = $.arr($.type(ID)).optional().get(params.includeUserIds);
	if (includeUserIdsErr) return rej('invalid includeUserIds param');

	// Get 'excludeUserIds' parameter
	const [excludeUserIds = [], excludeUserIdsErr] = $.arr($.type(ID)).optional().get(params.excludeUserIds);
	if (excludeUserIdsErr) return rej('invalid excludeUserIds param');

	// Get 'includeUserUsernames' parameter
	const [includeUserUsernames = [], includeUserUsernamesErr] = $.arr($.str).optional().get(params.includeUserUsernames);
	if (includeUserUsernamesErr) return rej('invalid includeUserUsernames param');

	// Get 'excludeUserUsernames' parameter
	const [excludeUserUsernames = [], excludeUserUsernamesErr] = $.arr($.str).optional().get(params.excludeUserUsernames);
	if (excludeUserUsernamesErr) return rej('invalid excludeUserUsernames param');

	// Get 'following' parameter
	const [following = null, followingErr] = $.bool.optional().nullable().get(params.following);
	if (followingErr) return rej('invalid following param');

	// Get 'mute' parameter
	const [mute = 'mute_all', muteErr] = $.str.optional().get(params.mute);
	if (muteErr) return rej('invalid mute param');

	// Get 'reply' parameter
	const [reply = null, replyErr] = $.bool.optional().nullable().get(params.reply);
	if (replyErr) return rej('invalid reply param');

	// Get 'renote' parameter
	const [renote = null, renoteErr] = $.bool.optional().nullable().get(params.renote);
	if (renoteErr) return rej('invalid renote param');

	// Get 'media' parameter
	const [media = null, mediaErr] = $.bool.optional().nullable().get(params.media);
	if (mediaErr) return rej('invalid media param');

	// Get 'poll' parameter
	const [poll = null, pollErr] = $.bool.optional().nullable().get(params.poll);
	if (pollErr) return rej('invalid poll param');

	// Get 'sinceDate' parameter
	const [sinceDate, sinceDateErr] = $.num.optional().get(params.sinceDate);
	if (sinceDateErr) throw 'invalid sinceDate param';

	// Get 'untilDate' parameter
	const [untilDate, untilDateErr] = $.num.optional().get(params.untilDate);
	if (untilDateErr) throw 'invalid untilDate param';

	// Get 'offset' parameter
	const [offset = 0, offsetErr] = $.num.optional().min(0).get(params.offset);
	if (offsetErr) return rej('invalid offset param');

	// Get 'limit' parameter
	const [limit = 10, limitErr] = $.num.optional().range(1, 30).get(params.limit);
	if (limitErr) return rej('invalid limit param');

	let includeUsers = includeUserIds;
	if (includeUserUsernames != null) {
		const ids = (await Promise.all(includeUserUsernames.map(async (username) => {
			const _user = await User.findOne({
				usernameLower: username.toLowerCase()
			});
			return _user ? _user._id : null;
		}))).filter(id => id != null);
		includeUsers = includeUsers.concat(ids);
	}

	let excludeUsers = excludeUserIds;
	if (excludeUserUsernames != null) {
		const ids = (await Promise.all(excludeUserUsernames.map(async (username) => {
			const _user = await User.findOne({
				usernameLower: username.toLowerCase()
			});
			return _user ? _user._id : null;
		}))).filter(id => id != null);
		excludeUsers = excludeUsers.concat(ids);
	}

	search(res, rej, me, tag, includeUsers, excludeUsers, following,
			mute, reply, renote, media, poll, sinceDate, untilDate, offset, limit);
});

async function search(
	res, rej, me, tag, includeUserIds, excludeUserIds, following,
	mute, reply, renote, media, poll, sinceDate, untilDate, offset, max) {

	let q: any = {
		$and: [{
			tags: tag
		}]
	};

	const push = x => q.$and.push(x);

	if (includeUserIds && includeUserIds.length != 0) {
		push({
			userId: {
				$in: includeUserIds
			}
		});
	} else if (excludeUserIds && excludeUserIds.length != 0) {
		push({
			userId: {
				$nin: excludeUserIds
			}
		});
	}

	if (following != null && me != null) {
		const ids = await getFriendIds(me._id, false);
		push({
			userId: following ? {
				$in: ids
			} : {
				$nin: ids.concat(me._id)
			}
		});
	}

	if (me != null) {
		const mutes = await Mute.find({
			muterId: me._id,
			deletedAt: { $exists: false }
		});
		const mutedUserIds = mutes.map(m => m.muteeId);

		switch (mute) {
			case 'mute_all':
				push({
					userId: {
						$nin: mutedUserIds
					},
					'_reply.userId': {
						$nin: mutedUserIds
					},
					'_renote.userId': {
						$nin: mutedUserIds
					}
				});
				break;
			case 'mute_related':
				push({
					'_reply.userId': {
						$nin: mutedUserIds
					},
					'_renote.userId': {
						$nin: mutedUserIds
					}
				});
				break;
			case 'mute_direct':
				push({
					userId: {
						$nin: mutedUserIds
					}
				});
				break;
			case 'direct_only':
				push({
					userId: {
						$in: mutedUserIds
					}
				});
				break;
			case 'related_only':
				push({
					$or: [{
						'_reply.userId': {
							$in: mutedUserIds
						}
					}, {
						'_renote.userId': {
							$in: mutedUserIds
						}
					}]
				});
				break;
			case 'all_only':
				push({
					$or: [{
						userId: {
							$in: mutedUserIds
						}
					}, {
						'_reply.userId': {
							$in: mutedUserIds
						}
					}, {
						'_renote.userId': {
							$in: mutedUserIds
						}
					}]
				});
				break;
		}
	}

	if (reply != null) {
		if (reply) {
			push({
				replyId: {
					$exists: true,
					$ne: null
				}
			});
		} else {
			push({
				$or: [{
					replyId: {
						$exists: false
					}
				}, {
					replyId: null
				}]
			});
		}
	}

	if (renote != null) {
		if (renote) {
			push({
				renoteId: {
					$exists: true,
					$ne: null
				}
			});
		} else {
			push({
				$or: [{
					renoteId: {
						$exists: false
					}
				}, {
					renoteId: null
				}]
			});
		}
	}

	if (media != null) {
		if (media) {
			push({
				mediaIds: {
					$exists: true,
					$ne: null
				}
			});
		} else {
			push({
				$or: [{
					mediaIds: {
						$exists: false
					}
				}, {
					mediaIds: null
				}]
			});
		}
	}

	if (poll != null) {
		if (poll) {
			push({
				poll: {
					$exists: true,
					$ne: null
				}
			});
		} else {
			push({
				$or: [{
					poll: {
						$exists: false
					}
				}, {
					poll: null
				}]
			});
		}
	}

	if (sinceDate) {
		push({
			createdAt: {
				$gt: new Date(sinceDate)
			}
		});
	}

	if (untilDate) {
		push({
			createdAt: {
				$lt: new Date(untilDate)
			}
		});
	}

	if (q.$and.length == 0) {
		q = {};
	}

	// Search notes
	const notes = await Note
		.find(q, {
			sort: {
				_id: -1
			},
			limit: max,
			skip: offset
		});

	// Serialize
	res(await Promise.all(notes.map(note => pack(note, me))));
}
