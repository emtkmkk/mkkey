/**
 * @packageDocumentation
 *
 * ドライブフォルダを更新する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `drive/folders/update`（POST `/api/drive/folders/update` で呼び出し）
 * - 認証必須。folderId で指定したフォルダの名前・親フォルダを更新する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { publishDriveStream } from "@/services/stream.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { DriveFolders } from "@/models/index.js";

export const meta = {
	tags: ["drive"],

	requireCredential: true,

	kind: "write:drive",

	errors: {
		noSuchFolder: {
			message: "そのfolderは存在しません。",
			code: "NO_SUCH_FOLDER",
			id: "f7974dac-2c0d-4a27-926e-23583b28e98e",
		},

		noSuchParentFolder: {
			message: "そのparent folderは存在しません。",
			code: "NO_SUCH_PARENT_FOLDER",
			id: "ce104e3a-faaf-49d5-b459-10ff0cbbcaa1",
		},

		recursiveNesting: {
			message: "フォルダを再帰的にネストするような構造にはできません。",
			code: "NO_SUCH_PARENT_FOLDER",
			id: "ce104e3a-faaf-49d5-b459-10ff0cbbcaa1",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "DriveFolder",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		folderId: { type: "string", format: "misskey:id" },
		name: { type: "string", maxLength: 200 },
		parentId: { type: "string", format: "misskey:id", nullable: true },
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

	if (ps.name) folder.name = ps.name;

	if (ps.parentId !== undefined) {
		if (ps.parentId === folder.id) {
			throw new ApiError(meta.errors.recursiveNesting);
		} else if (ps.parentId === null) {
			folder.parentId = null;
		} else {
			// 親フォルダを取得する
			const parent = await DriveFolders.findOneBy({
				id: ps.parentId,
				userId: user.id,
			});

			if (parent == null) {
				throw new ApiError(meta.errors.noSuchParentFolder);
			}

			// 循環参照が発生しないか確認する
			async function checkCircle(folderId: string): Promise<boolean> {
				// フォルダを取得する
				const folder2 = await DriveFolders.findOneBy({
					id: folderId,
				});

				if (folder2!.id === folder!.id) {
					return true;
				} else if (folder2!.parentId) {
					return await checkCircle(folder2!.parentId);
				} else {
					return false;
				}
			}

			if (parent.parentId !== null) {
				if (await checkCircle(parent.parentId)) {
					throw new ApiError(meta.errors.recursiveNesting);
				}
			}

			folder.parentId = parent.id;
		}
	}

	// 更新する
	DriveFolders.update(folder.id, {
		name: folder.name,
		parentId: folder.parentId,
	});

	const folderObj = await DriveFolders.pack(folder);

	// folderUpdated イベントを発行する
	publishDriveStream(user.id, "folderUpdated", folderObj);

	return folderObj;
});
