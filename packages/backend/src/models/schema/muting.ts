/**
 * @packageDocumentation
 *
 * 範囲付きユーザーミュートのAPIスキーマ。
 *
 * @internal
 */
export const packedMutingSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
		},
		expiresAt: {
			type: "string",
			optional: false,
			nullable: true,
			format: "date-time",
		},
		muteTypes: {
			type: "array",
			optional: false,
			nullable: false,
			items: {
				type: "string",
				enum: [
					"all",
					"note",
					"renote",
					"notification",
					"push",
					"reaction",
					"message",
					"follow",
				],
			},
		},
		muteeId: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
		},
		mutee: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "UserDetailed",
		},
	},
} as const;
