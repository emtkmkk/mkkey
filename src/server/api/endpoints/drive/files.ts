import $ from 'cafy'; import ID, { transform } from '../../../../misc/cafy-id';
import DriveFile, { packMany } from '../../../../models/drive-file';
import define from '../../define';

export const meta = {
	desc: {
		'ja-JP': 'ドライブのファイル一覧を取得します。',
		'en-US': 'Get files of drive.'
	},

	requireCredential: true,

	kind: 'drive-read',

	params: {
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

		folderId: {
			validator: $.type(ID).optional.nullable,
			default: null as any,
			transform: transform,
		},

		type: {
			validator: $.str.optional.match(/^[a-zA-Z\/\-\*]+$/)
		}
	}
};

export default define(meta, (ps, user) => new Promise(async (res, rej) => {
	// Check if both of sinceId and untilId is specified
	if (ps.sinceId && ps.untilId) {
		return rej('cannot set sinceId and untilId');
	}

	const sort = {
		_id: -1
	};

	const query = {
		'metadata.userId': user._id,
		'metadata.folderId': ps.folderId,
		'metadata.deletedAt': { $exists: false }
	} as any;

	if (ps.sinceId) {
		sort._id = 1;
		query._id = {
			$gt: ps.sinceId
		};
	} else if (ps.untilId) {
		query._id = {
			$lt: ps.untilId
		};
	}

	if (ps.type) {
		query.contentType = new RegExp(`^${ps.type.replace(/\*/g, '.+?')}$`);
	}

	const files = await DriveFile
		.find(query, {
			limit: ps.limit,
			sort: sort
		});

	res(await packMany(files, { detail: false, self: true }));
}));
