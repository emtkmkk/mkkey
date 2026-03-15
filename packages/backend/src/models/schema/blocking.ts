export const packedBlockingSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "ブロック関係の ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "ブロックした日時。",
		},
		blockeeId: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			description: "ブロックしているユーザーの ID。",
		},
		blockee: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "UserDetailed",
			description: "ブロックしているユーザー情報。",
		},
	},
} as const;
