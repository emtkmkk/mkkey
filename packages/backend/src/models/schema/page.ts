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
	},
} as const;
