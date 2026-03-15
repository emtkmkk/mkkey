/**
 * @packageDocumentation
 *
 * ドライブフォルダの API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** ドライブフォルダの API 用パック済みスキーマ。 */
export const packedDriveFolderSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			optional: false,
			nullable: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "フォルダの ID。",
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
			description: "フォルダ名。",
		},
		foldersCount: {
			type: "number",
			optional: true,
			nullable: false,
			description: "直下のサブフォルダ数。",
		},
		filesCount: {
			type: "number",
			optional: true,
			nullable: false,
			description: "直下のファイル数。",
		},
		parentId: {
			type: "string",
			optional: false,
			nullable: true,
			format: "id",
			example: "xxxxxxxxxx",
			description: "親フォルダの ID。",
		},
		parent: {
			type: "object",
			optional: true,
			nullable: true,
			ref: "DriveFolder",
			description: "親フォルダ情報。",
		},
	},
} as const;
