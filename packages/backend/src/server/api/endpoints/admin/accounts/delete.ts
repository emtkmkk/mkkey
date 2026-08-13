/**
 * @packageDocumentation
 *
 * 管理者が指定ユーザーアカウントを削除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `admin/accounts/delete`（POST `/api/admin/accounts/delete` で呼び出し）
 * - 認証必須・モデレーター権限必須。userId で指定したユーザーを物理削除する。
 * - ローカルユーザーの場合は Delete アクティビティ送信後に削除。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../../define.js";
import { Users } from "@/models/index.js";
import { doPostSuspend } from "@/services/suspend-user.js";
import { publishUserEvent } from "@/services/stream.js";
import { createDeleteAccountJob } from "@/queue/index.js";
import { notifyFollowersAccountWasDeleted } from "@/services/notify-followers-account-was-deleted.js";
import { revokeCredentialsForDeletedUser } from "@/services/delete-account.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error("user not found");
	}

	if (user.isAdmin) {
		throw new Error("cannot suspend admin");
	}

	if (user.isModerator) {
		throw new Error("cannot suspend moderator");
	}

	if (Users.isLocalUser(user)) {
		// 物理削除する前にDelete activityを送信する
		await doPostSuspend(user).catch((e) => {});

		// isDeleted 更新前に通知内容を作成する
		const followedDeletedNotified =
			await notifyFollowersAccountWasDeleted(user);

		createDeleteAccountJob(user, {
			soft: false,
			followedDeletedNotifiedIds: [...followedDeletedNotified],
		});
	} else {
		// isDeleted 更新前に通知内容を作成する
		const followedDeletedNotified =
			await notifyFollowersAccountWasDeleted(user);

		createDeleteAccountJob(user, {
			soft: true, // リモートユーザーの削除は、完全にDBから物理削除してしまうと再度連合してきてアカウントが復活する可能性があるため、soft指定する
			followedDeletedNotifiedIds: [...followedDeletedNotified],
		});
	}

	await Users.update(user.id, {
		isDeleted: true,
	});

	// トークンを失効させる（ソフト削除なので明示的に破棄しないと投稿できてしまう）
	await revokeCredentialsForDeletedUser(user);

	if (Users.isLocalUser(user)) {
		// ストリーミングを終了する
		publishUserEvent(user.id, "terminate", {});
	}
});
