/**
 * @packageDocumentation
 *
 * ドライブにフォルダを作成する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `drive/folders/create`（POST `/api/drive/folders/create` で呼び出し）
 * - 認証必須。name と親 folderId（任意）で新規フォルダを作成する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { publishDriveStream } from "@/services/stream.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { DriveFolders } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";

export const meta = {
	tags: ["drive"],

	requireCredential: true,

	kind: "write:drive",

	errors: {
		noSuchFolder: {
			message: "そのfolderは存在しません。",
			code: "NO_SUCH_FOLDER",
			id: "53326628-a00d-40a6-a3cd-8975105c0f95",
		},
	},

	res: {
		type: "object" as const,
		optional: false as const,
		nullable: false as const,
		ref: "DriveFolder",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		name: { type: "string", default: "Untitled", maxLength: 200 },
		parentId: { type: "string", format: "misskey:id", nullable: true },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// 親フォルダが指定されている場合
	let parent = null;
	if (ps.parentId) {
		// 親フォルダを取得する
		parent = await DriveFolders.findOneBy({
			id: ps.parentId,
			userId: user.id,
		});

		if (parent == null) {
			throw new ApiError(meta.errors.noSuchFolder);
		}
	}

	// フォルダを作成する
	const folder = await DriveFolders.insert({
		id: genId(),
		createdAt: new Date(),
		name: ps.name,
		parentId: parent !== null ? parent.id : null,
		userId: user.id,
	}).then((x) => DriveFolders.findOneByOrFail(x.identifiers[0]));

	const folderObj = await DriveFolders.pack(folder);

	// folderCreated イベントを発行する
	publishDriveStream(user.id, "folderCreated", folderObj);

	return folderObj;
});
