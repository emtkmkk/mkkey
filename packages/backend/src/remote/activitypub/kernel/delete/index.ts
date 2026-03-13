/**
 * @packageDocumentation
 *
 * ActivityPub の Delete アクティビティを処理する。オブジェクト種別に応じてノートまたはアクターの削除を行う。
 *
 * @remarks
 * - **役割**: inbox で Delete を受信した際に、ノート削除またはアクター削除を実行する。
 *
 * @see {@link services/note/delete} ノート削除
 * @internal
 */
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import { toSingle } from "@/prelude/array.js";
import { getApId, isTombstone, validPost, validActor } from "../../type.js";
import deleteNote from "./note.js";
import { deleteActor } from "./actor.js";
import type { IDelete, IObject } from "../../type.js";

/**
 * Delete アクティビティを処理する
 */
export default async (
	actor: CacheableRemoteUser,
	activity: IDelete,
): Promise<string> => {
	if ("actor" in activity && actor.uri !== activity.actor) {
		throw new Error("invalid actor");
	}

	// 削除対象オブジェクトの型
	let formerType: string | undefined;

	if (typeof activity.object === "string") {
		// 型は不明だが既に消えているためリモート解決は行わない
		formerType = undefined;
	} else {
		const object = activity.object as IObject;
		if (isTombstone(object)) {
			formerType = toSingle(object.formerType);
		} else {
			formerType = toSingle(object.type);
		}
	}

	const uri = getApId(activity.object);

	// 型が不明でも actor と object が同一なら `Person` とする
	if (!formerType && actor.uri === uri) {
		formerType = "Person";
	}

	// それ以外は `Note` にフォールバック
	if (!formerType) {
		formerType = "Note";
	}

	if (validPost.includes(formerType)) {
		return await deleteNote(actor, uri);
	} else if (validActor.includes(formerType)) {
		return await deleteActor(actor, uri);
	} else {
		return `Unknown type ${formerType}`;
	}
};
