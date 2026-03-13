/**
 * @packageDocumentation
 *
 * Packed Emoji スキーマ定義
 *
 * @remarks
 * - **役割**: API の絵文字レスポンス型と OpenAPI スキーマで利用する Packed Emoji の定義。
 * - license はライセンス補足情報。copyPermission, licenseName, usageInfo, creator, description, isBasedOnUrl, isTextOnly を個別に返す。
 *
 * @internal
 */
export const packedEmojiSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
		},
		aliases: {
			type: "array",
			optional: false,
			nullable: false,
			items: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
			},
		},
		name: {
			type: "string",
			optional: false,
			nullable: false,
		},
		category: {
			type: "string",
			optional: false,
			nullable: true,
		},
		host: {
			type: "string",
			optional: false,
			nullable: true,
			description: "ローカルホストは `null` で表す。",
		},
		url: {
			type: "string",
			optional: false,
			nullable: false,
		},
		license: {
			type: "string",
			optional: false,
			nullable: true,
			description: "ライセンス補足情報",
		},
		copyPermission: {
			type: "string",
			optional: false,
			nullable: true,
		},
		licenseName: {
			type: "string",
			optional: false,
			nullable: true,
		},
		usageInfo: {
			type: "string",
			optional: false,
			nullable: true,
		},
		creator: {
			type: "string",
			optional: false,
			nullable: true,
		},
		description: {
			type: "string",
			optional: false,
			nullable: true,
		},
		isBasedOnUrl: {
			type: "string",
			optional: false,
			nullable: true,
		},
		isTextOnly: {
			type: "boolean",
			optional: false,
			nullable: false,
		},
		sensitive: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "センシティブフラグ（ActivityPub では as:sensitive）",
		},
		usageVisibility: {
			type: "string",
			optional: true,
			nullable: true,
			description: "使用可能状態: public / limited / user / private",
		},
		allowedUserIds: {
			type: "array",
			optional: true,
			nullable: false,
			items: { type: "string", optional: false, nullable: false, format: "id" },
			description: "usageVisibility が user のときの許可ユーザ ID 配列",
		},
		motifUserId: {
			type: "string",
			optional: true,
			nullable: true,
			format: "id",
			description: "モチーフユーザー（紐づけユーザー）ID",
		},
		motifUserMode: {
			type: "string",
			optional: true,
			nullable: true,
			description: "モチーフの利用範囲: any / follow / owner",
		},
	},
} as const;
