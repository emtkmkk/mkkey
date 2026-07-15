import { notificationTypes } from "@/types.js";

/**
 * @packageDocumentation
 *
 * 通知の API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** 通知の API 用パック済みスキーマ。 */
export const packedNotificationSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "通知の ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "通知日時。",
		},
		isRead: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "既読か。",
		},
		type: {
			type: "string",
			optional: false,
			nullable: false,
			description: "通知の種類。",
			enum: [...notificationTypes],
		},
		user: {
			type: "object",
			ref: "UserLite",
			optional: true,
			nullable: true,
			description: "関連するユーザー情報。",
		},
		userId: {
			type: "string",
			optional: true,
			nullable: true,
			format: "id",
			description: "関連するユーザーの ID。",
		},
		note: {
			type: "object",
			ref: "Note",
			optional: true,
			nullable: true,
			description: "関連する投稿。",
		},
		reaction: {
			type: "string",
			optional: true,
			nullable: true,
			description: "リアクション文字列。",
		},
		choice: {
			type: "number",
			optional: true,
			nullable: true,
			description: "投票の選択肢番号。",
		},
		invitation: {
			type: "object",
			optional: true,
			nullable: true,
			description: "招待情報。",
		},
		body: {
			type: "string",
			optional: true,
			nullable: true,
			description: "本文。",
		},
		header: {
			type: "string",
			optional: true,
			nullable: true,
			description: "ヘッダー文。",
		},
		icon: {
			type: "string",
			optional: true,
			nullable: true,
			description: "アイコン URL。",
		},
		subIcon: {
			type: "string",
			optional: true,
			nullable: true,
			description: "アイコン右下に表示するサブアイコン（絵文字または画像 URL）。",
		},
	},
} as const;
