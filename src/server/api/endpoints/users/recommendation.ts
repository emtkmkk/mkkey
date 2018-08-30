const ms = require('ms');
import $ from 'cafy';
import User, { pack, ILocalUser } from '../../../../models/user';
import { getFriendIds } from '../../common/get-friends';
import Mute from '../../../../models/mute';

export const meta = {
	desc: {
		'ja-JP': 'おすすめのユーザー一覧を取得します。'
	},

	requireCredential: true,

	kind: 'account-read'
};

export default (params: any, me: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'limit' parameter
	const [limit = 10, limitErr] = $.num.optional.range(1, 100).get(params.limit);
	if (limitErr) return rej('invalid limit param');

	// Get 'offset' parameter
	const [offset = 0, offsetErr] = $.num.optional.min(0).get(params.offset);
	if (offsetErr) return rej('invalid offset param');

	// ID list of the user itself and other users who the user follows
	const followingIds = await getFriendIds(me._id);

	// ミュートしているユーザーを取得
	const mutedUserIds = (await Mute.find({
		muterId: me._id
	})).map(m => m.muteeId);

	const users = await User
		.find({
			_id: {
				$nin: followingIds.concat(mutedUserIds)
			},
			isLocked: false,
			$or: [{
				lastUsedAt: {
					$gte: new Date(Date.now() - ms('7days'))
				}
			}, {
				host: null
			}]
		}, {
			limit: limit,
			skip: offset,
			sort: {
				followersCount: -1
			}
		});

	// Serialize
	res(await Promise.all(users.map(async user =>
		await pack(user, me, { detail: true }))));
});
