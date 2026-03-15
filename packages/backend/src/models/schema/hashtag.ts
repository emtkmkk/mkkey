export const packedHashtagSchema = {
	type: "object",
	properties: {
		tag: {
			type: "string",
			optional: false,
			nullable: false,
			example: "calckey",
			description: "ハッシュタグの文字列（# なし）。",
		},
		mentionedUsersCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "このタグをメンションしたユーザー数（全体）。",
		},
		mentionedLocalUsersCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "このタグをメンションしたローカルユーザー数。",
		},
		mentionedRemoteUsersCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "このタグをメンションしたリモートユーザー数。",
		},
		attachedUsersCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "このタグを付けたユーザー数（全体）。",
		},
		attachedLocalUsersCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "このタグを付けたローカルユーザー数。",
		},
		attachedRemoteUsersCount: {
			type: "number",
			optional: false,
			nullable: false,
			description: "このタグを付けたリモートユーザー数。",
		},
	},
} as const;
