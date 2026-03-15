export const packedFollowingSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "フォロー関係の ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "フォローした日時。",
		},
		followeeId: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			description: "フォロー先ユーザーの ID。",
		},
		followee: {
			type: "object",
			optional: true,
			nullable: false,
			ref: "UserDetailed",
			description: "フォロー先のユーザー情報。",
		},
		followerId: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			description: "フォローしている側のユーザー ID。",
		},
		follower: {
			type: "object",
			optional: true,
			nullable: false,
			ref: "UserDetailed",
			description: "フォローしている側のユーザー情報。",
		},
	},
} as const;
