/**
 * @packageDocumentation
 *
 * チャンネルの API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** チャンネルの API 用パック済みスキーマ。 */
export const packedChannelSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "チャンネルの ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "作成日時。",
		},
		lastNotedAt: {
			type: "string",
			optional: false,
			nullable: true,
			format: "date-time",
			description: "最後に投稿された日時。",
		},
		name: {
			type: "string",
			optional: false,
			nullable: false,
			description: "チャンネル名。",
		},
		description: {
			type: "string",
			nullable: true,
			optional: false,
			description: "チャンネルの説明文。",
		},
		bannerUrl: {
			type: "string",
			format: "url",
			nullable: true,
			optional: false,
			description: "バナー画像の URL。",
		},
		notesCount: {
			type: "number",
			nullable: false,
			optional: false,
			description: "投稿数。",
		},
		usersCount: {
			type: "number",
			nullable: false,
			optional: false,
			description: "参加者数。",
		},
		isFollowing: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "フォロー中か。",
		},
		userId: {
			type: "string",
			nullable: true,
			optional: false,
			format: "id",
			description: "作成者のユーザー ID。",
		},
	},
} as const;
