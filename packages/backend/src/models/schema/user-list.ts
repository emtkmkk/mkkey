export const packedUserListSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "ユーザーリストの ID。",
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
			description: "リストの名前。",
		},
		userIds: {
			type: "array",
			nullable: false,
			optional: true,
			items: {
				type: "string",
				nullable: false,
				optional: false,
				format: "id",
			},
			description: "リストに含まれるユーザー ID の配列。",
		},
	},
} as const;
