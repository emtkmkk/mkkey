import $ from 'cafy'; import ID from '../../../../misc/cafy-id';
import Note from '../../../../models/note';
import Mute from '../../../../models/mute';
import { pack } from '../../../../models/note';
import { ILocalUser } from '../../../../models/user';

/**
 * Get timeline of global
 */
export default async (params: any, user: ILocalUser) => {
	// Get 'limit' parameter
	const [limit = 10, limitErr] = $.num.optional.range(1, 100).get(params.limit);
	if (limitErr) throw 'invalid limit param';

	// Get 'sinceId' parameter
	const [sinceId, sinceIdErr] = $.type(ID).optional.get(params.sinceId);
	if (sinceIdErr) throw 'invalid sinceId param';

	// Get 'untilId' parameter
	const [untilId, untilIdErr] = $.type(ID).optional.get(params.untilId);
	if (untilIdErr) throw 'invalid untilId param';

	// Get 'sinceDate' parameter
	const [sinceDate, sinceDateErr] = $.num.optional.get(params.sinceDate);
	if (sinceDateErr) throw 'invalid sinceDate param';

	// Get 'untilDate' parameter
	const [untilDate, untilDateErr] = $.num.optional.get(params.untilDate);
	if (untilDateErr) throw 'invalid untilDate param';

	// Check if only one of sinceId, untilId, sinceDate, untilDate specified
	if ([sinceId, untilId, sinceDate, untilDate].filter(x => x != null).length > 1) {
		throw 'only one of sinceId, untilId, sinceDate, untilDate can be specified';
	}

	// Get 'mediaOnly' parameter
	const [mediaOnly, mediaOnlyErr] = $.bool.optional.get(params.mediaOnly);
	if (mediaOnlyErr) throw 'invalid mediaOnly param';

	// ミュートしているユーザーを取得
	const mutedUserIds = user ? (await Mute.find({
		muterId: user._id
	})).map(m => m.muteeId) : null;

	//#region Construct query
	const sort = {
		_id: -1
	};

	const query = {
		// public only
		visibility: 'public',

		replyId: null
	} as any;

	if (mutedUserIds && mutedUserIds.length > 0) {
		query.userId = {
			$nin: mutedUserIds
		};

		query['_reply.userId'] = {
			$nin: mutedUserIds
		};

		query['_renote.userId'] = {
			$nin: mutedUserIds
		};
	}

	if (mediaOnly) {
		query.mediaIds = { $exists: true, $ne: [] };
	}

	if (sinceId) {
		sort._id = 1;
		query._id = {
			$gt: sinceId
		};
	} else if (untilId) {
		query._id = {
			$lt: untilId
		};
	} else if (sinceDate) {
		sort._id = 1;
		query.createdAt = {
			$gt: new Date(sinceDate)
		};
	} else if (untilDate) {
		query.createdAt = {
			$lt: new Date(untilDate)
		};
	}
	//#endregion

	// Issue query
	const timeline = await Note
		.find(query, {
			limit: limit,
			sort: sort
		});

	// Serialize
	return await Promise.all(timeline.map(note => pack(note, user)));
};
