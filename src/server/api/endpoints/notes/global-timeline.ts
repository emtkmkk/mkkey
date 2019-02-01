import $ from 'cafy'; import ID, { transform } from '../../../../misc/cafy-id';
import Note from '../../../../models/note';
import { packMany } from '../../../../models/note';
import define from '../../define';
import { countIf } from '../../../../prelude/array';
import fetchMeta from '../../../../misc/fetch-meta';
import { getHideUserIds } from '../../common/get-hide-users';

export const meta = {
	desc: {
		'ja-JP': 'グローバルタイムラインを取得します。'
	},

	params: {
		withFiles: {
			validator: $.bool.optional,
			desc: {
				'ja-JP': 'ファイルが添付された投稿に限定するか否か'
			}
		},

		mediaOnly: {
			validator: $.bool.optional,
			desc: {
				'ja-JP': 'ファイルが添付された投稿に限定するか否か (このパラメータは廃止予定です。代わりに withFiles を使ってください。)'
			}
		},

		limit: {
			validator: $.num.optional.range(1, 100),
			default: 10
		},

		sinceId: {
			validator: $.type(ID).optional,
			transform: transform,
		},

		untilId: {
			validator: $.type(ID).optional,
			transform: transform,
		},

		sinceDate: {
			validator: $.num.optional
		},

		untilDate: {
			validator: $.num.optional
		},
	}
};

export default define(meta, (ps, user) => new Promise(async (res, rej) => {
	const meta = await fetchMeta();
	if (meta.disableGlobalTimeline) {
		if (user == null || (!user.isAdmin && !user.isModerator)) {
			return rej('global timeline disabled');
		}
	}

	// Check if only one of sinceId, untilId, sinceDate, untilDate specified
	if (countIf(x => x != null, [ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate]) > 1) {
		return rej('only one of sinceId, untilId, sinceDate, untilDate can be specified');
	}

	// 隠すユーザーを取得
	const hideUserIds = await getHideUserIds(user);

	//#region Construct query
	const sort = {
		_id: -1
	};

	const query = {
		deletedAt: null,

		// public only
		visibility: 'public',

		replyId: null
	} as any;

	if (hideUserIds && hideUserIds.length > 0) {
		query.userId = {
			$nin: hideUserIds
		};

		query['_reply.userId'] = {
			$nin: hideUserIds
		};

		query['_renote.userId'] = {
			$nin: hideUserIds
		};
	}

	const withFiles = ps.withFiles != null ? ps.withFiles : ps.mediaOnly;

	if (withFiles) {
		query.fileIds = { $exists: true, $ne: [] };
	}

	if (ps.sinceId) {
		sort._id = 1;
		query._id = {
			$gt: ps.sinceId
		};
	} else if (ps.untilId) {
		query._id = {
			$lt: ps.untilId
		};
	} else if (ps.sinceDate) {
		sort._id = 1;
		query.createdAt = {
			$gt: new Date(ps.sinceDate)
		};
	} else if (ps.untilDate) {
		query.createdAt = {
			$lt: new Date(ps.untilDate)
		};
	}
	//#endregion

	const timeline = await Note
		.find(query, {
			limit: ps.limit,
			sort: sort
		});

	res(await packMany(timeline, user));
}));
