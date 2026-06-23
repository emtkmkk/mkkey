/**
 * @packageDocumentation
 *
 * ページの API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** ページの API 用パック済みスキーマ。 */
export const packedPageSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "ページの ID。",
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
		name: {
			type: "string",
			optional: false,
			nullable: false,
			description: "ページ名（URL 用）。",
		},
		summary: {
			type: "string",
			optional: false,
			nullable: true,
			description: "概要。",
		},
		content: {
			type: "array",
			optional: false,
			nullable: false,
			description: "本文ブロックの配列。",
		},
		variables: {
			type: "array",
			optional: false,
			nullable: false,
			description: "変数定義の配列。",
		},
		userId: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			description: "作成者のユーザー ID。",
		},
		user: {
			type: "object",
			ref: "UserLite",
			optional: false,
			nullable: false,
			description: "作成者情報。",
		},
		isPublic: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "公開ページか。",
		},
		alignCenter: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "本文を中央揃えにするか。",
		},
		font: {
			type: "string",
			optional: false,
			nullable: false,
			description: "フォント（serif / sans-serif）。",
		},
		script: {
			type: "string",
			optional: false,
			nullable: false,
			description: "ページスクリプト（AiScript）。",
		},
		eyeCatchingImageId: {
			type: "string",
			optional: true,
			nullable: true,
			format: "id",
			description: "アイキャッチ画像のファイル ID。",
		},
		eyeCatchingImage: {
			type: "object",
			ref: "DriveFile",
			optional: true,
			nullable: true,
			description: "アイキャッチ画像。",
		},
		attachedFiles: {
			type: "array",
			optional: false,
			nullable: false,
			items: {
				type: "object",
				ref: "DriveFile",
			},
			description: "本文に添付されたファイル一覧。",
		},
		likedCount: {
			type: "integer",
			optional: false,
			nullable: false,
			description: "いいね数。",
		},
		score: {
			type: "integer",
			optional: false,
			nullable: false,
			description: "注目スコア（いいね数と PV から算出）。",
		},
		isLiked: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "ログインユーザーがいいね済みか。",
		},
	},
} as const;
