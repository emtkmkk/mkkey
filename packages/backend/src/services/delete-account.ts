/**
 * @packageDocumentation
 *
 * アカウント削除（ソフト削除・ジョブ登録）を行うサービス。
 *
 * @remarks
 * - **役割**: アカウント削除 API から呼ばれ、ソフト削除と削除ジョブ登録を行う。
 *
 * @see {@link queue/processors/db/delete-account} アカウント削除キュー
 * @internal
 */

import { Users } from "@/models/index.js";
import { createDeleteAccountJob } from "@/queue/index.js";
import { publishUserEvent } from "./stream.js";
import { doPostSuspend } from "./suspend-user.js";

export async function deleteAccount(user: {
	id: string;
	host: string | null;
}): Promise<void> {
	// 物理削除する前にDelete activityを送信する
	await doPostSuspend(user).catch((e) => {});

	createDeleteAccountJob(user, {
		soft: true,
	});

	await Users.update(user.id, {
		isDeleted: true,
	});

	// ストリーミングを終了
	publishUserEvent(user.id, "terminate", {});
}
