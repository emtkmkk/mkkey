/**
 * @packageDocumentation
 *
 * クリップの API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** クリップの API 用パック済みスキーマ。 */
export const packedClipSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "クリップの ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "作成日時。",
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
		name: {
			type: "string",
			optional: false,
			nullable: false,
			description: "クリップ名。",
		},
		description: {
			type: "string",
			optional: false,
			nullable: true,
			description: "クリップの説明文。",
		},
		isPublic: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "公開クリップか。",
		},
	},
} as const;
