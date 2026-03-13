/**
 * @packageDocumentation
 *
 * ノートをお気に入りに登録する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/favorites/create`（POST `/api/notes/favorites/create` で呼び出し）
 * - 認証必須。noteId で指定したノートをお気に入りに追加する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { NoteFavorites } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { getNote } from "../../../common/getters.js";
import { publishInternalEvent } from "@/services/stream.js";

export const meta = {
	tags: ["notes", "favorites"],

	requireCredential: true,

	kind: "write:favorites",

	errors: {
		noSuchNote: {
			message: "その投稿は存在しません。",
			code: "NO_SUCH_NOTE",
			id: "6dd26674-e060-4816-909a-45ba3f4da458",
		},

		alreadyFavorited: {
			message: "The note has already been marked as a favorite.",
			code: "ALREADY_FAVORITED",
			id: "a402c12b-34dd-41d2-97d8-4d2ffd96a1a6",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: { type: "string", format: "misskey:id" },
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// お気に入り対象を取得する
	const note = await getNote(ps.noteId, user).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

	// 既にお気に入り済みの場合
	const exist = await NoteFavorites.findOneBy({
		noteId: note.id,
		userId: user.id,
	});

	if (exist != null) {
		throw new ApiError(meta.errors.alreadyFavorited);
	}

	// お気に入りを作成する
	await NoteFavorites.insert({
		id: genId(),
		createdAt: new Date(),
		noteId: note.id,
		userId: user.id,
	});

	publishInternalEvent("notePackFavoriteUpdated", {
		userId: user.id,
		noteId: note.id,
	});
});
