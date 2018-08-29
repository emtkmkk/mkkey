import $ from 'cafy'; import ID from '../../../../misc/cafy-id';
import User, { ILocalUser } from '../../../../models/user';
import Mute from '../../../../models/mute';

export const meta = {
	desc: {
		'ja-JP': 'ユーザーのミュートを解除します。',
		'en-US': 'Unmute a user'
	},

	requireCredential: true,

	kind: 'account/write'
};

export default (params: any, user: ILocalUser) => new Promise(async (res, rej) => {
	const muter = user;

	// Get 'userId' parameter
	const [userId, userIdErr] = $.type(ID).get(params.userId);
	if (userIdErr) return rej('invalid userId param');

	// Check if the mutee is yourself
	if (user._id.equals(userId)) {
		return rej('mutee is yourself');
	}

	// Get mutee
	const mutee = await User.findOne({
		_id: userId
	}, {
		fields: {
			data: false,
			profile: false
		}
	});

	if (mutee === null) {
		return rej('user not found');
	}

	// Check not muting
	const exist = await Mute.findOne({
		muterId: muter._id,
		muteeId: mutee._id
	});

	if (exist === null) {
		return rej('already not muting');
	}

	// Delete mute
	await Mute.remove({
		_id: exist._id
	});

	// Send response
	res();
});
