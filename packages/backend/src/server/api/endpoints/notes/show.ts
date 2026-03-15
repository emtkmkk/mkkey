/**
 * @packageDocumentation
 *
 * ノートの詳細を 1 件取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/show`（GET `/api/notes/show` で呼び出し）
 * - 認証は不要（プライベートモード時は必須）。noteId で指定したノートを返す。
 * - 返却は Note オブジェクト 1 件。存在しない場合は noSuchNote エラー。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { getNote } from "../../common/getters.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["notes"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description:
		"指定した ID の投稿 1 件の詳細を取得する。返信・リノート元などの関連情報も含めて返す。閲覧可能な投稿のみ取得できる。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Note",
	},

	errors: {
		noSuchNote: {
			message: "その投稿は存在しません。",
			code: "NO_SUCH_NOTE",
			id: "24fcbfc6-2e37-42b6-8388-c29b3861a08d",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: {
			type: "string",
			format: "misskey:id",
			description: "取得する投稿の ID。",
		},
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const note = await getNote(ps.noteId, user, true).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

	return await Notes.pack(note, user, {
		// FIXME: 返信またはリノートが非表示の場合、詳細付き pack でエラーになる可能性あり (#8774)
		detail: true,
		showInvisible: true,
	}).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});
});
