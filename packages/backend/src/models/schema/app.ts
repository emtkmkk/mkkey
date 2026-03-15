export const packedAppSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			description: "アプリケーションの ID。",
		},
		name: {
			type: "string",
			optional: false,
			nullable: false,
			description: "アプリ名。",
		},
		callbackUrl: {
			type: "string",
			optional: false,
			nullable: true,
			description: "OAuth コールバック先 URL。",
		},
		permission: {
			type: "array",
			optional: false,
			nullable: false,
			items: {
				type: "string",
				optional: false,
				nullable: false,
			},
			description: "許可されている権限の配列。",
		},
		secret: {
			type: "string",
			optional: true,
			nullable: false,
			description: "アプリシークレット（管理者用）。",
		},
		isAuthorized: {
			type: "boolean",
			optional: true,
			nullable: false,
			description: "現在のユーザーがこのアプリを認可しているか。",
		},
	},
} as const;
