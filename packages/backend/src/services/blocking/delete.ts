/**
 * @packageDocumentation
 *
 * ブロック解除処理を行うサービス。
 *
 * @remarks
 * - **役割**: ブロック解除 API から呼ばれ、ブロック関係を削除し Undo(Block) を配信する。
 * - ローカル blockee かつ wasUnblocked がミュートでないとき wasUnblocked を送る。
 *
 * @see {@link server/api/endpoints/blocking/delete} ブロック解除 API
 * @internal
 */

import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { renderBlock } from "@/remote/activitypub/renderer/block.js";
import renderUndo from "@/remote/activitypub/renderer/undo.js";
import { deliver } from "@/queue/index.js";
import Logger from "../logger.js";
import type { CacheableUser } from "@/models/entities/user.js";
import { Blockings, UserProfiles, Users } from "@/models/index.js";
import { unsetModerationWarningByAdminUnblock } from "../moderation-warning-by-admin-block.js";
import { createNotification } from "@/services/create-notification.js";
import { invalidateUserShowRelationCache } from "../invalidate-user-show-relation-cache.js";

const logger = new Logger("blocking/delete");

export default async function (blocker: CacheableUser, blockee: CacheableUser) {
	const blocking = await Blockings.findOneBy({
		blockerId: blocker.id,
		blockeeId: blockee.id,
	});

	if (blocking == null) {
		logger.warn(
			"ブロック解除がリクエストされましたがブロックしていませんでした",
		);
		return;
	}

	// ブロック側・被ブロック側は既に持っているため上記クエリで再取得せず、ここで手動でセットする
	blocking.blocker = blocker;
	blocking.blockee = blockee;

	await Blockings.delete(blocking.id);
	await unsetModerationWarningByAdminUnblock(blocker, blockee);
	await invalidateUserShowRelationCache(blocker.id, blockee.id);

	if (Users.isLocalUser(blockee)) {
		const profile = await UserProfiles.findOneBy({ userId: blockee.id });
		const unblockNotMuted =
			profile != null &&
			!profile.mutingNotificationTypes.includes("wasUnblocked");

		if (unblockNotMuted) {
			const notifier = await Users.findOneBy({ id: blocker.id });
			if (notifier != null) {
				await createNotification(
					blockee.id,
					"wasUnblocked",
					{
						notifierId: blocker.id,
					},
					{ notifier },
				);
			}
		}
	}

	// リモートブロックの場合は配信
	if (Users.isLocalUser(blocker) && Users.isRemoteUser(blockee)) {
		const content = renderActivity(renderUndo(renderBlock(blocking), blocker));
		deliver(blocker, content, blockee.inbox);
	}
}
