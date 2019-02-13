import $ from 'cafy';
import ID, { transform } from '../../../../misc/cafy-id';
import DriveFolder, { pack } from '../../../../models/drive-folder';
import define from '../../define';

export const meta = {
	desc: {
		'ja-JP': 'ドライブのフォルダ一覧を取得します。',
		'en-US': 'Get folders of drive.'
	},

	requireCredential: true,

	kind: 'drive-read',

	params: {
		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		sinceId: {
			validator: $.optional.type(ID),
			transform: transform,
		},

		untilId: {
			validator: $.optional.type(ID),
			transform: transform,
		},

		folderId: {
			validator: $.optional.nullable.type(ID),
			default: null as any,
			transform: transform,
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
		userId: user._id,
		parentId: ps.folderId
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

	const folders = await DriveFolder
		.find(query, {
			limit: ps.limit,
			sort: sort
		});

	res(await Promise.all(folders.map(folder => pack(folder))));
}));
