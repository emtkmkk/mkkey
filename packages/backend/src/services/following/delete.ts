/**
 * @packageDocumentation
 *
 * フォロー解除処理を行うサービス。
 *
 * @remarks
 * - **役割**: フォロー解除 API から呼ばれ、フォロー関係を削除し Undo(Follow) / Reject(Follow) を配信する。
 * - `kickFollower`（{@link server/api/endpoints/following/invalidate} 専用）ではフォロワーへ wasForciblyUnfollowed を送り、followee 向け userWasUnfollowed は送らない。
 *
 * @see {@link server/api/endpoints/following/delete} フォロー解除 API
 * @internal
 */

import {
	publishInternalEvent,
	publishMainStream,
	publishUserEvent,
} from "@/services/stream.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderFollow from "@/remote/activitypub/renderer/follow.js";
import renderUndo from "@/remote/activitypub/renderer/undo.js";
import renderReject from "@/remote/activitypub/renderer/reject.js";
import { deliver, webhookDeliver } from "@/queue/index.js";
import Logger from "../logger.js";
import { registerOrFetchInstanceDoc } from "../register-or-fetch-instance-doc.js";
import { ensureProxyFollowsListedUser } from "../user-list/ensure-proxy-follow.js";
import type { User } from "@/models/entities/user.js";
import { Followings, Users, Instances } from "@/models/index.js";
import {
	instanceChart,
	perUserFollowingChart,
} from "@/services/chart/index.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import { createNotification } from "@/services/create-notification.js";
import { notifyWasForciblyUnfollowed } from "./notify-forcibly-unfollowed.js";
import { invalidateUserShowRelationCache } from "../invalidate-user-show-relation-cache.js";

const logger = new Logger("following/delete");

/** following/invalidate など、フォロワー側の強制解除時に渡すオプション */
export type DeleteFollowingOptions = {
	/** フォロー先がフォロワーを外した（invalidate）。フォロワーに wasForciblyUnfollowed */
	kickFollower?: boolean;
};

export default async function (
	follower: {
		id: User["id"];
		host: User["host"];
		uri: User["host"];
		inbox: User["inbox"];
		sharedInbox: User["sharedInbox"];
	},
	followee: {
		id: User["id"];
		host: User["host"];
		uri: User["host"];
		inbox: User["inbox"];
		sharedInbox: User["sharedInbox"];
	},
	silent = false,
	options?: DeleteFollowingOptions,
) {
	const kickFollower = options?.kickFollower ?? false;

	const following = await Followings.findOneBy({
		followerId: follower.id,
		followeeId: followee.id,
	});

	if (following == null) {
		logger.warn(
			"フォロー解除がリクエストされましたがフォローしていませんでした",
		);
		return;
	}

	await Followings.delete(following.id);

	await decrementFollowing(follower, followee);
	await invalidateUserShowRelationCache(followee.id, follower.id);

	if (Users.isLocalUser(follower)) {
		publishInternalEvent("notePackFollowingUpdated", {
			userId: follower.id,
		});
	}

	// 自発アンフォロー時のみフォロワー側ストリーム（kickFollower 時は publishUnfollow 相当は reject 経路側）
	if (!silent && Users.isLocalUser(follower) && !kickFollower) {
		const packed = await Users.pack(followee.id, follower, {
			detail: true,
		});
		publishUserEvent(follower.id, "unfollow", packed);
		publishMainStream(follower.id, "unfollow", packed);
	}

	// フォロー先がローカル: 通常は userWasUnfollowed。フォロワー解除時は送らない
	if (Users.isLocalUser(followee) && !kickFollower) {
		const packed = await Users.pack(follower.id, followee, {
			detail: true,
		});
		if (!silent) {
			const notifier = await Users.findOneBy({ id: follower.id });
			if (notifier != null) {
				await createNotification(
					followee.id,
					"userWasUnfollowed",
					{
						notifierId: follower.id,
					},
					{ notifier },
				);
			}
		}

		const webhooks = (await getActiveWebhooks()).filter(
			(x) => x.userId === followee.id && x.on.includes("unfollow"),
		);
		for (const webhook of webhooks) {
			webhookDeliver(webhook, silent ? "silentUnfollow" : "unfollow", {
				user: packed,
			});
		}
	}

	// invalidate: ローカルフォロワーへ強制解除通知
	if (kickFollower && !silent) {
		await notifyWasForciblyUnfollowed(follower, followee);
	}

	if (Users.isLocalUser(follower) && Users.isRemoteUser(followee)) {
		const content = renderActivity(
			renderUndo(renderFollow(follower, followee), follower),
		);
		deliver(follower, content, followee.inbox);
		await ensureProxyFollowsListedUser(followee.id);
	}

	// リモートフォロワーを外すとき連合へ Reject（invalidate 含む）
	if (Users.isLocalUser(followee) && Users.isRemoteUser(follower)) {
		const content = renderActivity(
			renderReject(renderFollow(follower, followee), followee),
		);
		deliver(followee, content, follower.inbox);
	}
}

export async function decrementFollowing(
	follower: { id: User["id"]; host: User["host"] },
	followee: { id: User["id"]; host: User["host"] },
) {
	//#region フォロー・フォロワー数減算
	await Promise.all([
		Users.decrement({ id: follower.id }, "followingCount", 1),
		Users.decrement({ id: followee.id }, "followersCount", 1),
	]);
	//#endregion

	//#region インスタンス統計更新
	if (Users.isRemoteUser(follower) && Users.isLocalUser(followee)) {
		registerOrFetchInstanceDoc(follower.host).then((i) => {
			Instances.decrement({ id: i.id }, "followingCount", 1);
			instanceChart.updateFollowing(i.host, false);
		});
	} else if (Users.isLocalUser(follower) && Users.isRemoteUser(followee)) {
		registerOrFetchInstanceDoc(followee.host).then((i) => {
			Instances.decrement({ id: i.id }, "followersCount", 1);
			instanceChart.updateFollowers(i.host, false);
		});
	}
	//#endregion

	perUserFollowingChart.update(follower, followee, false);
}
