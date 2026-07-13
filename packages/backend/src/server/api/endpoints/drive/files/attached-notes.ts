/**
 * @packageDocumentation
 *
 * 指定ドライブファイルが添付されているノート一覧（または件数）を取得する API。
 *
 * @remarks
 * - **API パス**: `drive/files/attached-notes`
 * - `countOnly: true` のときはノートを pack せず `COUNT` のみ返す（削除確認用）。
 * - `= ANY(note.fileIds)` は既存 GIN `IDX_NOTE_FILE_IDS` を利用する。
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

	description:
		"指定したドライブファイルを添付しているノート一覧を取得します。countOnly 時は件数のみ返します。",

	// countOnly 時は { count }、通常時は Note[] を返す
	res: {
		type: "object",
		optional: false,
		nullable: false,
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
		/**
		 * true のときノート一覧ではなく件数だけ返す。
		 * 削除確認ダイアログ向け（pack しないので軽い）。
		 */
		countOnly: { type: "boolean", default: false },
	},
	required: ["fileId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const file = await DriveFiles.findOneBy(
		user.isAdmin || user.isModerator
			? { id: ps.fileId }
			: { id: ps.fileId, userId: user.id },
	);

	if (file == null) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	// 件数のみ（削除確認用）。GIN インデックスを使う COUNT。
	if (ps.countOnly) {
		const count = await Notes.createQueryBuilder("note")
			.where(":file = ANY(note.fileIds)", { file: file.id })
			.getCount();
		return { count };
	}

	const notes = await Notes.createQueryBuilder("note")
		.where(":file = ANY(note.fileIds)", { file: file.id })
		.getMany();

	return await Notes.packMany(notes, user, {
		detail: true,
	});
});
