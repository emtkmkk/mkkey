/**
 * @packageDocumentation
 *
 * 認証ユーザーの通知をすべて既読にする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notifications/mark-all-as-read`（POST `/api/notifications/mark-all-as-read` で呼び出し）
 * - 認証必須。未読通知を一括で既読にする。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { publishMainStream } from "@/services/stream.js";
import { pushNotification } from "@/services/push-notification.js";
import { Notifications } from "@/models/index.js";
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
	// ドキュメントを更新する
	await Notifications.update(
		{
			notifieeId: user.id,
			isRead: false,
		},
		{
			isRead: true,
		},
	);

	// 全ての通知を読みましたよというイベントを発行
	publishMainStream(user.id, "readAllNotifications");
	pushNotification(user.id, "readAllNotifications", undefined);
});
