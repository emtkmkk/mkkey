/**
 * @packageDocumentation
 *
 * API 処理用のノート・ユーザー取得。可視性を考慮した getNote、getUser、getUserForRelation、getRemoteUser、getLocalUser を提供する。
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
 * @remarks
 * `showInvisible` が false（既定）のときは、見つからなければ例外を投げるので必ずノートが返る。
 * true のときだけ null が返りうるため、戻り値の型をオーバーロードで分けている。
 *
 * @param noteId - ノート ID
 * @param me - 自分（null の場合は未ログイン）
 * @param showInvisible - 非表示ノートも返すか
 * @returns ノート
 * @throws IdentifiableError `showInvisible` が false で、ノートが見つからない場合
 */
export async function getNote(
	noteId: Note["id"],
	me: { id: User["id"] } | null,
	showInvisible?: false,
): Promise<Note>;
export async function getNote(
	noteId: Note["id"],
	me: { id: User["id"] } | null,
	showInvisible: boolean,
): Promise<Note | null>;
export async function getNote(
	noteId: Note["id"],
	me: { id: User["id"] } | null,
	showInvisible = false,
): Promise<Note | null> {
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
 *
 * @remarks
 * NB: 削除済み（`isDeleted`）のユーザーもそのまま返す。管理者向けの API や削除ジョブが使うため。
 * フォローやリスト追加など、相手との関係を新しく作る API では {@link getUserForRelation} を使うこと。
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
 * 相手との関係（フォロー・リスト追加・メッセージ・グループ招待など）を新しく作るために、ユーザーを取得する。
 *
 * @param userId - ユーザー ID
 * @returns 削除されていないユーザー
 * @throws {@link IdentifiableError} ユーザーが無いか削除済みのとき（{@link getUser} と同じ ID）
 *
 * @remarks
 * - 削除は論理削除なので、削除済みのユーザーも行は残っている。弾かないと、削除済みの人への
 *   フォロー申請などが新しく作られ、相手が返事をしないので永遠に残る。
 * - 「存在しない」と同じエラーにするのは、プロフィール（`users/show`）の扱いと合わせるため。
 *   呼び出し側の既存のエラー変換（noSuchUser）がそのまま使える。
 *
 * @internal
 */
export async function getUserForRelation(userId: User["id"]) {
	const user = await getUser(userId);

	if (user.isDeleted) {
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
