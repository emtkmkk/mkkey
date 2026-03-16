/**
 * @packageDocumentation
 *
 * 投稿（Note）の API 用パック済みスキーマ定義。
 *
 * @internal
 */
export const packedNoteSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "投稿の ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "作成日時。",
		},
		text: {
			type: "string",
			optional: false,
			nullable: true,
			description: "本文。",
		},
		cw: {
			type: "string",
			optional: true,
			nullable: true,
			description: "内容警告（ネタバレ等）。",
		},
		userId: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			description: "投稿者のユーザー ID。",
		},
		user: {
			type: "object",
			ref: "UserLite",
			optional: false,
			nullable: false,
			description: "投稿者情報。",
		},
		replyId: {
			type: "string",
			optional: true,
			nullable: true,
			format: "id",
			example: "xxxxxxxxxx",
			description: "返信先の投稿 ID。",
		},
		renoteId: {
			type: "string",
			optional: true,
			nullable: true,
			format: "id",
			example: "xxxxxxxxxx",
			description: "リノート元の投稿 ID。",
		},
		reply: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "Note",
			description: "返信先の投稿。",
		},
		renote: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "Note",
			description: "リノート元の投稿。",
		},
		visibility: {
			type: "string",
			optional: false,
			nullable: false,
			description: "公開範囲。",
		},
		mentions: {
			type: "array",
			optional: true,
			nullable: false,
			items: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
			},
			description: "メンションされたユーザー ID の配列。",
		},
		visibleUserIds: {
			type: "array",
			optional: true,
			nullable: false,
			items: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
			},
			description: "指定公開時に表示先のユーザー ID の配列。",
		},
		fileIds: {
			type: "array",
			optional: true,
			nullable: false,
			items: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
			},
			description: "添付ファイルの ID の配列。",
		},
		files: {
			type: "array",
			optional: true,
			nullable: false,
			items: {
				type: "object",
				optional: false,
				nullable: false,
				ref: "DriveFile",
			},
			description: "添付ファイル情報の配列。",
		},
		tags: {
			type: "array",
			optional: true,
			nullable: false,
			items: {
				type: "string",
				optional: false,
				nullable: false,
			},
			description: "ハッシュタグの配列。",
		},
		poll: {
			type: "object",
			optional: true,
			nullable: true,
			description: "アンケート情報。",
		},
		channelId: {
			type: "string",
			optional: true,
			nullable: true,
			format: "id",
			example: "xxxxxxxxxx",
			description: "投稿先チャンネルの ID。",
		},
		channel: {
			type: "object",
			optional: true,
			nullable: true,
			items: {
				type: "object",
				optional: false,
				nullable: false,
				properties: {
					id: {
						type: "string",
						optional: false,
						nullable: false,
					},
					name: {
						type: "string",
						optional: false,
						nullable: true,
					},
				},
			},
			description: "投稿先チャンネル情報。",
		},
		localOnly: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "ローカルのみ表示か。",
		},
		emojis: {
			type: "object",
			optional: true,
			nullable: true,
			description: "カスタム絵文字のマッピング。",
		},
		reactions: {
			type: "object",
			optional: false,
			nullable: false,
			description: "リアクション数（種類ごと）。",
		},
		renoteCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "リノート数。",
		},
		repliesCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "返信数。",
		},
		uri: {
			type: "string",
			optional: true,
			nullable: false,
			description: "ActivityPub の URI。",
		},
		url: {
			type: "string",
			optional: true,
			nullable: false,
			description: "投稿の Web 上の URL。",
		},
		myReaction: {
			type: "object",
			optional: true,
			nullable: true,
			description: "自分が付けたリアクション。",
		},
		deletedAt: {
			type: "string",
			optional: true,
			nullable: true,
			format: "date-time",
			description: "削除日時。",
		},
		/** true のときのみ API レスポンスに含まれる。文頭で Bot 1件のみメンションしている投稿かどうか。 */
		isBotMention: {
			type: "boolean",
			optional: true,
			nullable: false,
			description:
				"文頭でBot1件のみメンションしている投稿か。true のときのみキーが含まれる。TLフィルタで Bot が関わる返信として扱う。",
		},
	},
} as const;
