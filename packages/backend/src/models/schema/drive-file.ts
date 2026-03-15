/**
 * @packageDocumentation
 *
 * ドライブファイルの API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** ドライブファイルの API 用パック済みスキーマ。 */
export const packedDriveFileSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "ファイルの ID。",
		},
		createdAt: {
			type: "string",
			optional: false,
			nullable: false,
			format: "date-time",
			description: "アップロード日時。",
		},
		name: {
			type: "string",
			optional: false,
			nullable: false,
			example: "lenna.jpg",
			description: "ファイル名。",
		},
		type: {
			type: "string",
			optional: false,
			nullable: false,
			example: "image/jpeg",
			description: "MIME タイプ。",
		},
		md5: {
			type: "string",
			optional: false,
			nullable: false,
			format: "md5",
			example: "15eca7fba0480996e2245f5185bf39f2",
			description: "MD5 ハッシュ。",
		},
		size: {
			type: "number",
			optional: false,
			nullable: false,
			example: 51469,
			description: "ファイルサイズ（バイト）。",
		},
		isSensitive: {
			type: "boolean",
			optional: false,
			nullable: false,
			description: "センシティブ指定か。",
		},
		blurhash: {
			type: "string",
			optional: false,
			nullable: true,
			description: "ブラーハッシュ。",
		},
		properties: {
			type: "object",
			optional: false,
			nullable: false,
			description: "画像・動画などのメタデータ。",
			properties: {
				width: {
					type: "number",
					optional: true,
					nullable: false,
					example: 1280,
				},
				height: {
					type: "number",
					optional: true,
					nullable: false,
					example: 720,
				},
				orientation: {
					type: "number",
					optional: true,
					nullable: false,
					example: 8,
				},
				avgColor: {
					type: "string",
					optional: true,
					nullable: false,
					example: "rgb(40,65,87)",
				},
			},
		},
		url: {
			type: "string",
			optional: false,
			nullable: true,
			format: "url",
			description: "ファイルの URL。",
		},
		thumbnailUrl: {
			type: "string",
			optional: false,
			nullable: true,
			format: "url",
			description: "サムネイルの URL。",
		},
		originalUrl: {
			type: "string",
			optional: false,
			nullable: true,
			format: "url",
			description: "原寸の URL。",
		},
		comment: {
			type: "string",
			optional: false,
			nullable: true,
			description: "コメント。",
		},
		folderId: {
			type: "string",
			optional: false,
			nullable: true,
			format: "id",
			example: "xxxxxxxxxx",
			description: "親フォルダの ID。",
		},
		folder: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "DriveFolder",
			description: "親フォルダ情報。",
		},
		userId: {
			type: "string",
			optional: false,
			nullable: true,
			format: "id",
			example: "xxxxxxxxxx",
			description: "所有者のユーザー ID。",
		},
		user: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "UserLite",
			description: "所有者情報。",
		},
	},
} as const;
