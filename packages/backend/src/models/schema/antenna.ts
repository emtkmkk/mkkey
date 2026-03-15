/**
 * @packageDocumentation
 *
 * アンテナの API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** アンテナの API 用パック済みスキーマ。 */
export const packedAntennaSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			description: "アンテナの ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "作成日時。",
		},
		name: {
			type: "string",
			optional: false,
			nullable: false,
			description: "アンテナ名。",
		},
		keywords: {
			type: "array",
			optional: false,
			nullable: false,
			description: "キーワード（AND グループの配列）。",
			items: {
				type: "array",
				optional: false,
				nullable: false,
				items: {
					type: "string",
					optional: false,
					nullable: false,
				},
			},
		},
		excludeKeywords: {
			type: "array",
			optional: false,
			nullable: false,
			description: "除外キーワード。",
			items: {
				type: "array",
				optional: false,
				nullable: false,
				items: {
					type: "string",
					optional: false,
					nullable: false,
				},
			},
		},
		src: {
			type: "string",
			optional: false,
			nullable: false,
			description: "取得元（home / all / users / list / group / instances）。",
			enum: ["home", "all", "users", "list", "group", "instances"],
		},
		userListId: {
			type: "string",
			optional: false,
			nullable: true,
			format: "id",
			description: "ユーザーリストの ID（src が list のとき）。",
		},
		userGroupId: {
			type: "string",
			optional: false,
			nullable: true,
			format: "id",
			description: "ユーザーグループの ID（src が group のとき）。",
		},
		users: {
			type: "array",
			optional: false,
			nullable: false,
			description: "対象ユーザー ID の配列（src が users のとき）。",
			items: {
				type: "string",
				optional: false,
				nullable: false,
			},
		},
		instances: {
			type: "array",
			optional: false,
			nullable: false,
			description: "対象インスタンスの配列（src が instances のとき）。",
			items: {
				type: "string",
				optional: false,
				nullable: false,
			},
		},
		caseSensitive: {
			type: "boolean",
			optional: false,
			nullable: false,
			default: false,
			description: "キーワードの大文字小文字を区別するか。",
		},
		notify: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "新着で通知するか。",
		},
		withReplies: {
			type: "boolean",
			optional: false,
			nullable: false,
			default: false,
			description: "返信を含めるか。",
		},
		withFile: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "ファイル添付投稿に限定するか。",
		},
		hasUnreadNote: {
			type: "boolean",
			optional: false,
			nullable: false,
			default: false,
			description: "未読の投稿があるか。",
		},
	},
} as const;
