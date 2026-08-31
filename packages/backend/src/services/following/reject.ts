/**
 * @packageDocumentation
 *
 * フォローリクエスト拒否・Reject(Follow) 配信・AP 受信 Reject の処理。
 *
 * @internal
 */

import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderFollow from "@/remote/activitypub/renderer/follow.js";
import renderReject from "@/remote/activitypub/renderer/reject.js";
import { deliver, webhookDeliver } from "@/queue/index.js";
import {
	publishInternalEvent,
	publishMainStream,
	publishUserEvent,
} from "@/services/stream.js";
import type { ILocalUser, IRemoteUser } from "@/models/entities/user.js";
import { User } from "@/models/entities/user.js";
import { Users, FollowRequests, Followings } from "@/models/index.js";
import { decrementFollowing } from "./delete.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import { notifyWasForciblyUnfollowed } from "./notify-forcibly-unfollowed.js";
import {
	notifyFollowRequestRejected,
	upsertFollowReconfirm,
} from "./follow-reconfirm.js";
import { invalidateUserShowRelationCache } from "../invalidate-user-show-relation-cache.js";

type Local =
	| ILocalUser
	| {
			id: ILocalUser["id"];
			host: ILocalUser["host"];
			uri: ILocalUser["uri"];
	  };
type Remote =
	| IRemoteUser
	| {
			id: IRemoteUser["id"];
			host: IRemoteUser["host"];
			uri: IRemoteUser["uri"];
			inbox: IRemoteUser["inbox"];
	  };
type Both = Local | Remote;

/**
 * API following/request/reject
 */
export async function rejectFollowRequest(user: Local, follower: Both) {
	if (Users.isRemoteUser(follower)) {
		deliverReject(user, follower);
	}

	const removed = await removeFollowRequest(user, follower);

	if (removed && Users.isLocalUser(follower)) {
		await notifyFollowRequestRejected(follower, user);
		await upsertFollowReconfirm(
			follower.id,
			user.id,
			"followRequestRejected",
		);
		publishUnfollow(user, follower);
	} else if (Users.isLocalUser(follower)) {
		publishUnfollow(user, follower);
	}
}

/**
 * API following/reject
 */
export async function rejectFollow(user: Local, follower: Both) {
	if (Users.isRemoteUser(follower)) {
		deliverReject(user, follower);
	}

	const removed = await removeFollow(user, follower);

	if (Users.isLocalUser(follower)) {
		if (removed) {
			await notifyWasForciblyUnfollowed(follower, user);
		}
		publishUnfollow(user, follower);
	}
}

/**
 * AP Reject/Follow（リモートがローカルのフォロー／申請を拒否）
 */
export async function remoteReject(actor: Remote, follower: Local) {
	const requestRemoved = await removeFollowRequest(actor, follower);
	const removed = await removeFollow(actor, follower);
	if (requestRemoved) {
		await notifyFollowRequestRejected(follower, actor);
		await upsertFollowReconfirm(
			follower.id,
			actor.id,
			"followRequestRejected",
		);
	} else if (removed) {
		await notifyWasForciblyUnfollowed(follower, actor);
		await upsertFollowReconfirm(
			follower.id,
			actor.id,
			"wasForciblyUnfollowed",
		);
	}
	publishUnfollow(actor, follower);
}

/**
 * Remove follow request record
 */
async function removeFollowRequest(followee: Both, follower: Both): Promise<boolean> {
	const request = await FollowRequests.findOneBy({
		followeeId: followee.id,
		followerId: follower.id,
	});

	if (!request) return false;

	await FollowRequests.delete(request.id);
	await invalidateUserShowRelationCache(followee.id, follower.id);
	return true;
}

/**
 * Remove follow record
 *
 * @returns Followings 行を削除したか
 */
async function removeFollow(followee: Both, follower: Both): Promise<boolean> {
	const following = await Followings.findOneBy({
		followeeId: followee.id,
		followerId: follower.id,
	});

	if (!following) return false;

	await Followings.delete(following.id);
	await decrementFollowing(follower, followee);
	await invalidateUserShowRelationCache(followee.id, follower.id);

	if (Users.isLocalUser(follower)) {
		publishInternalEvent("notePackFollowingUpdated", {
			userId: follower.id,
		});
	}

	return true;
}

/**
 * Deliver Reject to remote
 */
async function deliverReject(followee: Local, follower: Remote) {
	const request = await FollowRequests.findOneBy({
		followeeId: followee.id,
		followerId: follower.id,
	});

	const content = renderActivity(
		renderReject(
			renderFollow(follower, followee, request?.requestId || undefined),
			followee,
		),
	);
	deliver(followee, content, follower.inbox);
}

/**
 * Publish unfollow to local
 */
async function publishUnfollow(followee: Both, follower: Local) {
	const packedFollowee = await Users.pack(followee.id, follower, {
		detail: true,
	});

	publishUserEvent(follower.id, "unfollow", packedFollowee);
	publishMainStream(follower.id, "unfollow", packedFollowee);

	const webhooks = (await getActiveWebhooks()).filter(
		(x) => x.userId === follower.id && x.on.includes("unfollow"),
	);
	for (const webhook of webhooks) {
		webhookDeliver(webhook, "deletefollow", {
			user: packedFollowee,
		});
	}
}
