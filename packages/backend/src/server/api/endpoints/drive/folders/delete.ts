/**
 * @packageDocumentation
 *
 * ドライブフォルダを削除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `drive/folders/delete`（POST `/api/drive/folders/delete` で呼び出し）
 * - 認証必須。folderId で指定したフォルダを削除する。配下のファイルは親フォルダへ移動される。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../../define.js";
import { publishDriveStream } from "@/services/stream.js";
import { ApiError } from "../../../error.js";
import { DriveFolders, DriveFiles } from "@/models/index.js";

export const meta = {
	tags: ["drive"],

	requireCredential: true,

	kind: "write:drive",

	errors: {
		noSuchFolder: {
			message: "そのfolderは存在しません。",
			code: "NO_SUCH_FOLDER",
			id: "1069098f-c281-440f-b085-f9932edbe091",
		},

		hasChildFilesOrFolders: {
			message: "This folder has child files or folders.",
			code: "HAS_CHILD_FILES_OR_FOLDERS",
			id: "b0fc8a17-963c-405d-bfbc-859a487295e1",
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

	const [childFoldersCount, childFilesCount] = await Promise.all([
		DriveFolders.countBy({ parentId: folder.id }),
		DriveFiles.countBy({ folderId: folder.id }),
	]);

	if (childFoldersCount !== 0 || childFilesCount !== 0) {
		throw new ApiError(meta.errors.hasChildFilesOrFolders);
	}

	await DriveFolders.delete(folder.id);

	// folderDeleted イベントを発行する
	publishDriveStream(user.id, "folderDeleted", folder.id);
});
