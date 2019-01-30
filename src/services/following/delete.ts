import User, { isLocalUser, isRemoteUser, pack as packUser, IUser } from '../../models/user';
import Following from '../../models/following';
import { publishMainStream } from '../../stream';
import { renderActivity } from '../../remote/activitypub/renderer';
import renderFollow from '../../remote/activitypub/renderer/follow';
import renderUndo from '../../remote/activitypub/renderer/undo';
import { deliver } from '../../queue';
import perUserFollowingChart from '../../chart/per-user-following';

export default async function(follower: IUser, followee: IUser) {
	const following = await Following.findOne({
		followerId: follower._id,
		followeeId: followee._id
	});

	if (following == null) {
		console.warn('フォロー解除がリクエストされましたがフォローしていませんでした');
		return;
	}

	Following.remove({
		_id: following._id
	});

	//#region Decrement following count
	User.update({ _id: follower._id }, {
		$inc: {
			followingCount: -1
		}
	});
	//#endregion

	//#region Decrement followers count
	User.update({ _id: followee._id }, {
		$inc: {
			followersCount: -1
		}
	});
	//#endregion

	perUserFollowingChart.update(follower, followee, false);

	// Publish unfollow event
	if (isLocalUser(follower)) {
		packUser(followee, follower, {
			detail: true
		}).then(packed => publishMainStream(follower._id, 'unfollow', packed));
	}

	if (isLocalUser(follower) && isRemoteUser(followee)) {
		const content = renderActivity(renderUndo(renderFollow(follower, followee), follower));
		deliver(follower, content, followee.inbox);
	}
}
