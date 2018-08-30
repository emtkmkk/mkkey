import $ from 'cafy'; import ID from '../../../../../misc/cafy-id';
import UserList from '../../../../../models/user-list';
import User, { pack as packUser, isRemoteUser, getGhost, ILocalUser } from '../../../../../models/user';
import { publishUserListStream } from '../../../../../stream';
import ap from '../../../../../remote/activitypub/renderer';
import renderFollow from '../../../../../remote/activitypub/renderer/follow';
import { deliver } from '../../../../../queue';

export const meta = {
	desc: {
		'ja-JP': '指定したユーザーリストに指定したユーザーを追加します。',
		'en-US': 'Add a user to a user list.'
	},

	requireCredential: true,

	kind: 'account-write'
};

/**
 * Add a user to a user list
 */
export default async (params: any, me: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'listId' parameter
	const [listId, listIdErr] = $.type(ID).get(params.listId);
	if (listIdErr) return rej('invalid listId param');

	// Fetch the list
	const userList = await UserList.findOne({
		_id: listId,
		userId: me._id,
	});

	if (userList == null) {
		return rej('list not found');
	}

	// Get 'userId' parameter
	const [userId, userIdErr] = $.type(ID).get(params.userId);
	if (userIdErr) return rej('invalid userId param');

	// Fetch the user
	const user = await User.findOne({
		_id: userId
	});

	if (user == null) {
		return rej('user not found');
	}

	if (userList.userIds.map(id => id.toHexString()).includes(user._id.toHexString())) {
		return rej('the user already added');
	}

	// Push the user
	await UserList.update({ _id: userList._id }, {
		$push: {
			userIds: user._id
		}
	});

	res();

	publishUserListStream(userList._id, 'userAdded', await packUser(user));

	// このインスタンス内にこのリモートユーザーをフォローしているユーザーがいなくても投稿を受け取るためにダミーのユーザーがフォローしたということにする
	if (isRemoteUser(user)) {
		const ghost = await getGhost();
		const content = ap(renderFollow(ghost, user));
		deliver(ghost, content, user.inbox);
	}
});
