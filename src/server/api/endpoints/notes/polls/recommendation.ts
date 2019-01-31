import $ from 'cafy';
import Vote from '../../../../../models/poll-vote';
import Note, { pack } from '../../../../../models/note';
import define from '../../../define';
import Mute from '../../../../../models/mute';

export const meta = {
	desc: {
		'ja-JP': 'おすすめのアンケート一覧を取得します。',
		'en-US': 'Get recommended polls.'
	},

	requireCredential: true,

	params: {
		limit: {
			validator: $.num.optional.range(1, 100),
			default: 10
		},

		offset: {
			validator: $.num.optional.min(0),
			default: 0
		}
	}
};

export default define(meta, (ps, user) => new Promise(async (res, rej) => {
	// Get votes
	const votes = await Vote.find({
		userId: user._id
	}, {
		fields: {
			_id: false,
			noteId: true
		}
	});

	const nin = votes && votes.length != 0 ? votes.map(v => v.noteId) : [];

	// ミュートしているユーザーを取得
	const mutedUserIds = await Mute.find({
		muterId: user._id
	}).then(ms => ms.map(m => m.muteeId));

	const notes = await Note
		.find({
			'_user.host': null,
			_id: {
				$nin: nin
			},
			userId: {
				$ne: user._id,
				$nin: mutedUserIds
			},
			poll: {
				$exists: true,
				$ne: null
			}
		}, {
			limit: ps.limit,
			skip: ps.offset,
			sort: {
				_id: -1
			}
		});

	res(await Promise.all(notes.map(note => pack(note, user, {
		detail: true
	}))));
}));
