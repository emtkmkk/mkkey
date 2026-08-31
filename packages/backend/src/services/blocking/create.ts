/**
 * @packageDocumentation
 *
 * ブロック作成処理を行うサービス。
 *
 * @remarks
 * - **役割**: ブロック API から呼ばれ、ブロック関係を DB に保存し AP 配信を行う。
 * - ブロック時はフォロー解除が最大 2 件走る。`userWasUnfollowed` / `wasForciblyUnfollowed` / `wasBlocked` をそれぞれ独立して発火する。
 * - TL からの非表示は従来どおりミュート側の責務のため、ブロック成功後に無期限 `all` ミュートを冪等付与する。
 *   （Web UI・API・ブロックインポートで差が出ないようにする）
 * NOTE: 管理人ブロックは API 側で拒否されるため、ここでの管理人向けミュート例外は不要。
 *
 * @see {@link server/api/endpoints/blocking/create} ブロック API
 * @see {@link services/muting.addMutingScope} ミュート範囲の冪等付与
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
import { renderBlock } from "@/remote/activitypub/renderer/block.js";
import { deliver } from "@/queue/index.js";
import renderReject from "@/remote/activitypub/renderer/reject.js";
import type { Blocking } from "@/models/entities/blocking.js";
import type { User } from "@/models/entities/user.js";
import {
	Blockings,
	Users,
	FollowRequests,
	Followings,
	UserListJoinings,
	UserLists,
	NoteWatchings,
} from "@/models/index.js";
import { perUserFollowingChart } from "@/services/chart/index.js";
import { genId } from "@/misc/gen-id.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import { invalidateListMembersCache } from "@/misc/antenna-members-cache.js";
import { webhookDeliver } from "@/queue/index.js";
import { ensureProxyFollowsListedUser } from "../user-list/ensure-proxy-follow.js";
import { setModerationWarningByAdminBlock } from "../moderation-warning-by-admin-block.js";
import { createNotification } from "@/services/create-notification.js";
import { invalidateUserShowRelationCache } from "../invalidate-user-show-relation-cache.js";
import { addMutingScope } from "../muting.js";
import { notifyWasForciblyUnfollowed } from "../following/notify-forcibly-unfollowed.js";

/**
 * ブロック関係を作成し、TL非表示用の all ミュートを付与する。
 *
 * @param blocker - ブロックする側
 * @param blockee - ブロックされる側
 * @returns 完了を示す Promise
 * @internal
 */
export default async function (blocker: User, blockee: User) {
	const [, , blockerUnfollowedBlockee, blockeeUnfollowedBlocker] =
		await Promise.all([
			cancelRequest(blocker, blockee),
			cancelRequest(blockee, blocker),
			unFollow(blocker, blockee),
			unFollow(blockee, blocker),
			removeFromList(blockee, blocker),
		]);

	if (Users.isLocalUser(blocker) && Users.isRemoteUser(blockee)) {
		await ensureProxyFollowsListedUser(blockee);
	}

	const blocking = {
		id: genId(),
		createdAt: new Date(),
		blocker,
		blockerId: blocker.id,
		blockee,
		blockeeId: blockee.id,
	} as Blocking;

	await Blockings.insert(blocking);
	await ensureAllMuteForBlock(blocker, blockee);
	await setModerationWarningByAdminBlock(blocker, blockee);
	if (Users.isLocalUser(blocker)) {
		publishUserEvent(blocker.id, "blockChange", blockee);
	}
	if (Users.isLocalUser(blockee)) {
		publishUserEvent(blockee.id, "blockChange", blocker);
	}

	if (Users.isLocalUser(blockee)) {
		// ブロック側が相手のフォローを外した → 手動アンフォローと同種の通知
		if (blockerUnfollowedBlockee) {
			await createNotification(
				blockee.id,
				"userWasUnfollowed",
				{
					notifierId: blocker.id,
				},
				{ notifier: blocker },
			);
		}
		// ブロックされた側が相手へのフォローを外された → 強制解除
		if (blockeeUnfollowedBlocker) {
			await notifyWasForciblyUnfollowed(blockee, blocker);
		}
		await createNotification(
			blockee.id,
			"wasBlocked",
			{
				notifierId: blocker.id,
			},
			{ notifier: blocker },
		);
	}

	if (Users.isLocalUser(blocker) && Users.isRemoteUser(blockee)) {
		const content = renderActivity(renderBlock(blocking));
		deliver(blocker, content, blockee.inbox);
	}

	await invalidateUserShowRelationCache(blocker.id, blockee.id);
}

/**
 * ブロックに伴い TL 非表示用の無期限 all ミュートを冪等付与する。
 *
 * @param blocker - ブロックする側（ミュートする側）
 * @param blockee - ブロックされる側（ミュートされる側）
 * @returns 完了を示す Promise
 *
 * @remarks
 * - `addMutingScope(..., "all")` により既存の個別範囲があっても `all` に揃える。
 * - ストリームのミュート集合更新のため `mute` ユーザーイベントを発行する。
 *
 * @internal
 */
async function ensureAllMuteForBlock(
	blocker: User,
	blockee: User,
): Promise<void> {
	await addMutingScope(blocker.id, blockee.id, "all", null);
	publishUserEvent(blocker.id, "mute", blockee);
	await NoteWatchings.delete({
		userId: blocker.id,
		noteUserId: blockee.id,
	});
}

async function cancelRequest(follower: User, followee: User) {
	const request = await FollowRequests.findOneBy({
		followeeId: followee.id,
		followerId: follower.id,
	});

	if (request == null) {
		return;
	}

	await FollowRequests.delete({
		followeeId: followee.id,
		followerId: follower.id,
	});

	if (Users.isLocalUser(followee)) {
		Users.pack(followee, followee, {
			detail: true,
		}).then((packed) => publishMainStream(followee.id, "meUpdated", packed));
	}

	if (Users.isLocalUser(followee)) {
		Users.pack(follower.id, followee, {
			detail: true,
		}).then(async (packed) => {
			const webhooks = (await getActiveWebhooks()).filter(
				(x) => x.userId === followee.id && x.on.includes("unfollow"),
			);
			for (const webhook of webhooks) {
				webhookDeliver(webhook, "rejectRequest", {
					user: packed,
				});
			}
		});
	}

	// リモートにフォローリクエストをしていたらUndoFollow送信
	if (Users.isLocalUser(follower) && Users.isRemoteUser(followee)) {
		const content = renderActivity(
			renderUndo(renderFollow(follower, followee), follower),
		);
		deliver(follower, content, followee.inbox);
	}

	// リモートからフォローリクエストを受けていたらReject送信
	if (Users.isRemoteUser(follower) && Users.isLocalUser(followee)) {
		const content = renderActivity(
			renderReject(
				renderFollow(follower, followee, request.requestId!),
				followee,
			),
		);
		deliver(followee, content, follower.inbox);
	}
}

async function unFollow(follower: User, followee: User): Promise<boolean> {
	const following = await Followings.findOneBy({
		followerId: follower.id,
		followeeId: followee.id,
	});

	if (following == null) {
		return false;
	}

	await Promise.all([
		Followings.delete(following.id),
		Users.decrement({ id: follower.id }, "followingCount", 1),
		Users.decrement({ id: followee.id }, "followersCount", 1),
		perUserFollowingChart.update(follower, followee, false),
	]);

	if (Users.isLocalUser(follower)) {
		publishInternalEvent("notePackFollowingUpdated", {
			userId: follower.id,
		});
	}

	// アンフォローイベントを発行
	if (Users.isLocalUser(follower)) {
		Users.pack(followee, follower, {
			detail: true,
		}).then(async (packed) => {
			publishUserEvent(follower.id, "unfollow", packed);
			publishMainStream(follower.id, "unfollow", packed);
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
				webhookDeliver(webhook, "unfollow", {
					user: packed,
				});
			}
		});
	}

	// リモートにフォローをしていたらUndoFollow送信
	if (Users.isLocalUser(follower) && Users.isRemoteUser(followee)) {
		const content = renderActivity(
			renderUndo(renderFollow(follower, followee), follower),
		);
		deliver(follower, content, followee.inbox);
	}

	return true;
}

async function removeFromList(listOwner: User, user: User) {
        const userLists = await UserLists.findBy({
                userId: listOwner.id,
        });

        const deletePromises = userLists.map((userList) =>
                UserListJoinings.delete({
                        userListId: userList.id,
                        userId: user.id,
                }),
        );

        await Promise.all(deletePromises);

        for (const userList of userLists) {
                invalidateListMembersCache(userList.id);
        }
}
