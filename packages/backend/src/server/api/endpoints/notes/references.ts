/**
 * @packageDocumentation
 *
 * リモート親投稿の参照一覧を lazy 取得する API。
 *
 * @remarks
 * - ローカル親投稿では 400 を返す（クライアントは `pack.references` を使う）。
 * - 閲覧者別キャッシュ経由で origin 再取得を抑える。
 *
 * @internal
 */
import define from "../../define.js";
import { In } from "typeorm";
import { ApiError } from "../../error.js";
import { getNote } from "../../common/getters.js";
import { Notes } from "@/models/index.js";
import { resolveRemoteReferenceIds } from "@/services/note/remote-references.js";

export const meta = {
	tags: ["notes"],

	requireCredential: true,
	kind: "read:account",

	description:
		"リモート投稿の参照一覧を取得する。初回は origin へ署名付き取得し、以降は閲覧者別キャッシュを使う。",

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
		noSuchNote: {
			message: "その投稿は存在しません。",
			code: "NO_SUCH_NOTE",
			id: "9725d0ce-ba28-4dde-95a7-2cbb2c15de24",
		},
		localNoteNotSupported: {
			message: "ローカル投稿の参照は pack.references を使用してください。",
			code: "LOCAL_NOTE_REFERENCES_NOT_SUPPORTED",
			id: "c8e4f1a2-3b5d-4e9f-a7c6-2d8b9e0f1a3c",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: {
			type: "string",
			format: "misskey:id",
			description: "参照を取得する親投稿の ID",
		},
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const parentNote = await getNote(ps.noteId, user).catch(() => null);
	if (!parentNote) {
		throw new ApiError(meta.errors.noSuchNote);
	}

	if (!parentNote.userHost) {
		throw new ApiError(meta.errors.localNoteNotSupported);
	}

	const referenceIds = await resolveRemoteReferenceIds(parentNote, user);

	if (referenceIds.length === 0) {
		return [];
	}

	const refs = await Notes.findBy({ id: In(referenceIds) });
	const orderMap = new Map(referenceIds.map((id, i) => [id, i]));
	const sorted = refs.sort(
		(a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
	);

	return Notes.packMany(sorted, user, { detail: true });
});
