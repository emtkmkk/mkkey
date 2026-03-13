/**
 * @packageDocumentation
 *
 * フォロー解除処理を行うサービス。
 *
 * @remarks
 * - **役割**: フォロー解除 API から呼ばれ、フォロー関係を削除し Undo(Follow) を配信する。
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

const logger = new Logger("following/delete");

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
) {
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

	decrementFollowing(follower, followee);

	if (Users.isLocalUser(follower)) {
		publishInternalEvent("notePackFollowingUpdated", {
			userId: follower.id,
		});
	}

	// アンフォローイベントを発行
	if (!silent && Users.isLocalUser(follower)) {
		Users.pack(followee.id, follower, {
			detail: true,
		}).then(async (packed) => {
			publishUserEvent(follower.id, "unfollow", packed);
			publishMainStream(follower.id, "unfollow", packed);

			/* const webhooks = (await getActiveWebhooks()).filter(
				(x) => x.userId === followee.id && x.on.includes("unfollow"),
			);
			for (const webhook of webhooks) {
				webhookDeliver(webhook, silent ? "silentUnfollow" : "unfollow", {
					user: packed,
				});
			}*/
		});
	}

	if (Users.isLocalUser(followee)) {
		Users.pack(follower.id, followee, {
			detail: true,
		}).then(async (packed) => {
			const webhooks = (await getActiveWebhooks()).filter(
				(x) => x.userId === followee.id && x.on.includes("unfollow"),
			);
			for (const webhook of webhooks) {
				webhookDeliver(webhook, silent ? "silentUnfollow" : "unfollow", {
					user: packed,
				});
			}
		});
	}

        if (Users.isLocalUser(follower) && Users.isRemoteUser(followee)) {
                const content = renderActivity(
                        renderUndo(renderFollow(follower, followee), follower),
                );
                deliver(follower, content, followee.inbox);
                await ensureProxyFollowsListedUser(followee.id);
        }

	if (Users.isLocalUser(followee) && Users.isRemoteUser(follower)) {
		// ローカルユーザーの host は null
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
