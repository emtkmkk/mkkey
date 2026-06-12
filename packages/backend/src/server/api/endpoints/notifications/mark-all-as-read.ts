/**
 * @packageDocumentation
 *
 * 認証ユーザーの通知をすべて既読にする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notifications/mark-all-as-read`（POST `/api/notifications/mark-all-as-read` で呼び出し）
 * - 認証必須。未読通知を一括で既読にする。
 * - {@link readAllNotifications} 経由で Redis キャッシュも更新する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Notifications } from "@/models/index.js";
import { readAllNotifications } from "../../common/read-notification.js";
import define from "../../define.js";

export const meta = {
	tags: ["notifications", "account"],

	requireCredential: true,

	kind: "write:notifications",
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const latestUnread = await Notifications.findOne({
		where: {
			notifieeId: user.id,
			isRead: false,
		},
		order: { id: "DESC" },
		select: ["id"],
	});

	if (latestUnread == null) return;

	await readAllNotifications(user.id, latestUnread.id);
});
