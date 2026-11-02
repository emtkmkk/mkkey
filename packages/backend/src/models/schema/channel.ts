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
		// isFollowing と同様、ログイン時のみ付く
		isFavorited: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "お気に入り登録しているか。お気に入り機能が無いため常に false。",
		},
		hasUnreadNote: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "未読の投稿があるか。ログイン時のみ含まれる。",
		},
		// ピン留め機能は無いので常に空配列（他実装との互換のため返している）
		pinnedNoteIds: {
			type: "array",
			optional: false,
			nullable: false,
			description: "ピン留め投稿の ID。ピン留め機能が無いため常に空。",
			items: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
			},
		},
		pinnedNotes: {
			type: "array",
			optional: false,
			nullable: false,
			description: "ピン留め投稿。ピン留め機能が無いため常に空。",
			items: {
				type: "object",
				optional: false,
				nullable: false,
				ref: "Note",
			},
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
