/**
 * @packageDocumentation
 *
 * ギャラリー投稿の API 用パック済みスキーマ定義。
 *
 * @internal
 */
export const packedGalleryPostSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "ギャラリー投稿の ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "作成日時。",
		},
		updatedAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "更新日時。",
		},
		title: {
			type: "string",
			optional: false,
			nullable: false,
			description: "タイトル。",
		},
		description: {
			type: "string",
			optional: false,
			nullable: true,
			description: "投稿の説明文。",
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
			description: "添付ファイルの ID 配列。",
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
			description: "添付ファイルの情報配列。",
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
			description: "タグの配列。",
		},
		isSensitive: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "センシティブ指定されているか。",
		},
		likedCount: {
			type: "integer",
			optional: false,
			nullable: false,
			description: "いいね数。",
		},
		isLiked: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "ログインユーザーがいいね済みか。",
		},
	},
} as const;
