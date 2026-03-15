/**
 * @packageDocumentation
 *
 * メッセージ（MessagingMessage）の API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** メッセージの API 用パック済みスキーマ。 */
export const packedMessagingMessageSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "メッセージの ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "送信日時。",
		},
		userId: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			description: "送信者のユーザー ID。",
		},
		user: {
			type: "object",
			ref: "UserLite",
			optional: true,
			nullable: false,
			description: "送信者情報。",
		},
		text: {
			type: "string",
			optional: false,
			nullable: true,
			description: "本文。",
		},
		fileId: {
			type: "string",
			optional: true,
			nullable: true,
			format: "id",
			description: "添付ファイルの ID。",
		},
		file: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "DriveFile",
			description: "添付ファイル情報。",
		},
		recipientId: {
			type: "string",
			optional: false,
			nullable: true,
			format: "id",
			description: "受信者のユーザー ID（DM の場合）。",
		},
		recipient: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "UserLite",
			description: "受信者情報。",
		},
		groupId: {
			type: "string",
			optional: false,
			nullable: true,
			format: "id",
			description: "グループの ID（グループメッセージの場合）。",
		},
		group: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "UserGroup",
			description: "グループ情報。",
		},
		isRead: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "既読か。",
		},
		reads: {
			type: "array",
			optional: true,
			nullable: false,
			description: "既読にしたユーザー ID の配列。",
			items: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
			},
		},
	},
} as const;
