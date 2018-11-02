import $ from 'cafy';
import ID, { transform } from '../../../../misc/cafy-id';
import define from '../../define';
import User from '../../../../models/user';

export const meta = {
	desc: {
		'ja-JP': '指定したユーザーの凍結を解除します。',
		'en-US': 'Unsuspend a user.'
	},

	requireCredential: true,
	requireAdmin: true,

	params: {
		userId: {
			validator: $.type(ID),
			transform: transform,
			desc: {
				'ja-JP': '対象のユーザーID',
				'en-US': 'The user ID which you want to unsuspend'
			}
		},
	}
};

export default define(meta, (ps) => new Promise(async (res, rej) => {
	const user = await User.findOne({
		_id: ps.userId
	});

	if (user == null) {
		return rej('user not found');
	}

	await User.findOneAndUpdate({
		_id: user._id
	}, {
			$set: {
				isSuspended: false
			}
		});

	res();
}));
