export const packedUserGroupSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "ユーザーグループの ID。",
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
			description: "グループ名。",
		},
		ownerId: {
			type: "string",
			nullable: false,
			optional: false,
			format: "id",
			description: "オーナーのユーザー ID。",
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
			description: "グループに属するユーザー ID の配列。",
		},
	},
} as const;
