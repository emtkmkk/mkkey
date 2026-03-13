/**
 * @packageDocumentation
 *
 * API 処理用のノート・ユーザー取得。可視性を考慮した getNote、getUser、getRemoteUser、getLocalUser を提供する。
 *
 * @remarks
 * - **役割**: エンドポイントから参照され、ノート ID やユーザー ID から可視性を考慮して 1 件取得する。存在・権限で ApiError を投げる。
 *
 * @see {@link define} エンドポイント
 * @internal
 */
import { IdentifiableError } from "@/misc/identifiable-error.js";
import type { User } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
import { Notes, Users } from "@/models/index.js";
import { generateVisibilityQuery } from "./generate-visibility-query.js";

/**
 * API 処理用にノートを取得する。可視性を考慮する。
 *
 * @param noteId - ノート ID
 * @param me - 自分（null の場合は未ログイン）
 * @param showInvisible - 非表示ノートも返すか
 * @returns ノート
 */
export async function getNote(
	noteId: Note["id"],
	me: { id: User["id"] } | null,
	showInvisible = false,
) {
	const query = Notes.createQueryBuilder("note").where("note.id = :id", {
		id: noteId,
	});

	if (!showInvisible) {
		generateVisibilityQuery(query, me);
	}

	const note = await query.getOne();

	if (note == null && !showInvisible) {
		throw new IdentifiableError(
			"9725d0ce-ba28-4dde-95a7-2cbb2c15de24",
			"該当するノートがありません。",
		);
	}

	return note;
}

/**
 * API 処理用にユーザーを取得する。
 *
 * @param userId - ユーザー ID
 * @returns ユーザー
 */
export async function getUser(userId: User["id"]) {
	const user = await Users.findOneBy({ id: userId });

	if (user == null) {
		throw new IdentifiableError(
			"15348ddd-432d-49c2-8a5a-8069753becff",
			"該当するユーザーがありません。",
		);
	}

	return user;
}

/**
 * API 処理用にリモートユーザーを取得する。
 *
 * @param userId - ユーザー ID
 * @returns リモートユーザー
 */
export async function getRemoteUser(userId: User["id"]) {
	const user = await getUser(userId);

	if (!Users.isRemoteUser(user)) {
		throw new Error("user is not a remote user");
	}

	return user;
}

/**
 * API 処理用にローカルユーザーを取得する。
 *
 * @param userId - ユーザー ID
 * @returns ローカルユーザー
 */
export async function getLocalUser(userId: User["id"]) {
	const user = await getUser(userId);

	if (!Users.isLocalUser(user)) {
		throw new Error("user is not a local user");
	}

	return user;
}
