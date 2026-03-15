/**
 * @packageDocumentation
 *
 * 指定ドライブファイルが添付されているノート一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `drive/files/attached-notes`（GET `/api/drive/files/attached-notes` で呼び出し）
 * - 認証必須。fileId で指定したファイルを添付しているノートの一覧を返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { DriveFiles, Notes } from "@/models/index.js";

export const meta = {
	tags: ["drive", "notes"],

	requireCredential: true,

	kind: "read:drive",

	description: "指定したドライブファイルを添付しているノート一覧を取得します。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "Note",
		},
	},

	errors: {
		noSuchFile: {
			message: "No such file.",
			code: "NO_SUCH_FILE",
			id: "c118ece3-2e4b-4296-99d1-51756e32d232",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		fileId: { type: "string", format: "misskey:id" },
	},
	required: ["fileId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// ファイルを取得する
	const file = await DriveFiles.findOneBy({
		id: ps.fileId,
		userId: user.id,
	});

	if (file == null) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	const notes = await Notes.createQueryBuilder("note")
		.where(":file = ANY(note.fileIds)", { file: file.id })
		.getMany();

	return await Notes.packMany(notes, user, {
		detail: true,
	});
});
