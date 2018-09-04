import User, { IUser, isRemoteUser, ILocalUser, pack as packUser } from '../../../models/user';
import FollowRequest from '../../../models/follow-request';
import pack from '../../../remote/activitypub/renderer';
import renderFollow from '../../../remote/activitypub/renderer/follow';
import renderAccept from '../../../remote/activitypub/renderer/accept';
import { deliver } from '../../../queue';
import Following from '../../../models/following';
import FollowingLog from '../../../models/following-log';
import FollowedLog from '../../../models/followed-log';
import { publishUserStream } from '../../../stream';

export default async function(followee: IUser, follower: IUser) {
	const following = await Following.insert({
		createdAt: new Date(),
		followerId: follower._id,
		followeeId: followee._id,

		// 非正規化
		_follower: {
			host: follower.host,
			inbox: isRemoteUser(follower) ? follower.inbox : undefined,
			sharedInbox: isRemoteUser(follower) ? follower.sharedInbox : undefined
		},
		_followee: {
			host: followee.host,
			inbox: isRemoteUser(followee) ? followee.inbox : undefined,
			sharedInbox: isRemoteUser(followee) ? followee.sharedInbox : undefined
		}
	});

	if (isRemoteUser(follower)) {
		const content = pack(renderAccept(renderFollow(follower, followee)));
		deliver(followee as ILocalUser, content, follower.inbox);
	}

	await FollowRequest.remove({
		followeeId: followee._id,
		followerId: follower._id
	});

	//#region Increment following count
	await User.update({ _id: follower._id }, {
		$inc: {
			followingCount: 1
		}
	});

	FollowingLog.insert({
		createdAt: following.createdAt,
		userId: follower._id,
		count: follower.followingCount + 1
	});
	//#endregion

	//#region Increment followers count
	await User.update({ _id: followee._id }, {
		$inc: {
			followersCount: 1
		}
	});

	FollowedLog.insert({
		createdAt: following.createdAt,
		userId: followee._id,
		count: followee.followersCount + 1
	});
	//#endregion

	await User.update({ _id: followee._id }, {
		$inc: {
			pendingReceivedFollowRequestsCount: -1
		}
	});

	packUser(followee, followee, {
		detail: true
	}).then(packed => publishUserStream(followee._id, 'meUpdated', packed));

	packUser(followee, follower).then(packed => publishUserStream(follower._id, 'follow', packed));
}
