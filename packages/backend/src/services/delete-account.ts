/**
 * @packageDocumentation
 *
 * アカウント削除（ソフト削除・ジョブ登録）を行うサービス。
 *
 * @remarks
 * - **役割**: アカウント削除 API から呼ばれ、フォロワー通知・ソフト削除・削除ジョブ登録を行う。
 * - `followedAccountWasDeleted` は `isDeleted` 更新前に送り、通知 pack 時の表示名置換を避ける。
 *
 * @see {@link queue/processors/db/delete-account} アカウント削除キュー
 * @internal
 */

import { Users } from "@/models/index.js";
import { createDeleteAccountJob } from "@/queue/index.js";
import { publishUserEvent } from "./stream.js";
import { doPostSuspend } from "./suspend-user.js";
import { notifyFollowersAccountWasDeleted } from "./notify-followers-account-was-deleted.js";

export async function deleteAccount(user: {
	id: string;
	host: string | null;
}): Promise<void> {
	const target = await Users.findOneByOrFail({ id: user.id });

	// 物理削除する前にDelete activityを送信する
	await doPostSuspend(user).catch((e) => {});

	// isDeleted 更新前に通知内容を作成する（Users.pack の削除済み置換より前）
	const followedDeletedNotified =
		await notifyFollowersAccountWasDeleted(target);

	createDeleteAccountJob(user, {
		soft: true,
		followedDeletedNotifiedIds: [...followedDeletedNotified],
	});

	await Users.update(user.id, {
		isDeleted: true,
	});

	// ストリーミングを終了
	publishUserEvent(user.id, "terminate", {});
}
