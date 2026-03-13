/**
 * @packageDocumentation
 *
 * ブロック解除処理を行うサービス。
 *
 * @remarks
 * - **役割**: ブロック解除 API から呼ばれ、ブロック関係を削除し Undo(Block) を配信する。
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
import { User } from "@/models/entities/user.js";
import { Blockings, Users } from "@/models/index.js";

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

	Blockings.delete(blocking.id);

	// リモートブロックの場合は配信
	if (Users.isLocalUser(blocker) && Users.isRemoteUser(blockee)) {
		const content = renderActivity(renderUndo(renderBlock(blocking), blocker));
		deliver(blocker, content, blockee.inbox);
	}
}
