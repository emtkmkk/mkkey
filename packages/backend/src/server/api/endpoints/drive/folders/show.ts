/**
 * @packageDocumentation
 *
 * ドライブフォルダの詳細を 1 件取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `drive/folders/show`（GET `/api/drive/folders/show` で呼び出し）
 * - 認証必須。folderId で指定したフォルダを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { DriveFolders } from "@/models/index.js";

export const meta = {
	tags: ["drive"],

	requireCredential: true,

	kind: "read:drive",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "DriveFolder",
	},

	errors: {
		noSuchFolder: {
			message: "そのfolderは存在しません。",
			code: "NO_SUCH_FOLDER",
			id: "d74ab9eb-bb09-4bba-bf24-fb58f761e1e9",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		folderId: { type: "string", format: "misskey:id" },
	},
	required: ["folderId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// フォルダを取得する
	const folder = await DriveFolders.findOneBy({
		id: ps.folderId,
		userId: user.id,
	});

	if (folder == null) {
		throw new ApiError(meta.errors.noSuchFolder);
	}

	return await DriveFolders.pack(folder, {
		detail: true,
	});
});
