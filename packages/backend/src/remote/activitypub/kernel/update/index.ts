/**
 * @packageDocumentation
 *
 * ActivityPub の Update アクティビティを処理する。Person または Note 等の更新を受け付ける。
 *
 * @remarks
 * - **役割**: inbox で Update を受信した際に、Person/Note 等の既存オブジェクトを更新する。
 *
 * @see {@link remote/activitypub/models/person} Person 更新
 * @internal
 */
import type {
	CacheableRemoteUser,
	ILocalUser,
} from "@/models/entities/user.js";
import type { IUpdate } from "../../type.js";
import { getApId, getApType, isActor } from "../../type.js";
import { apLogger } from "../../logger.js";
import { fetchNote, updateNote } from "../../models/note.js";
import Resolver from "../../resolver.js";
import { updatePerson } from "../../models/person.js";
import { getApLock } from "@/misc/app-lock.js";
import { Notes } from "@/models/index.js";
import { StatusError } from "@/misc/fetch.js";
import { extractDbHost } from "@/misc/convert-host.js";

/**
 * Update アクティビティを処理する
 */
export default async (
	actor: CacheableRemoteUser,
	activity: IUpdate,
	additionalTo?: ILocalUser["id"],
): Promise<string> => {
	if ("actor" in activity && actor.uri !== activity.actor) {
		return "skip: invalid actor";
	}

	apLogger.debug("Update");

	const resolver = new Resolver();

	const object = await resolver.resolve(activity.object).catch((e) => {
		apLogger.error(`Resolution failed: ${e}`);
		throw e;
	});

	// GHSA-675w-hf2m-qwmj / GHSA-5h8r-gq97-xv69 対策:
	// Update 対象オブジェクトが actor（送信者）と同一ホストに帰属することを検証する。
	// これにより、他ホストのプロフィール/ノート/投票を書き換えるなりすましを防ぐ。
	// （activity.object が埋め込みオブジェクトの場合、resolver は fetch せずそのまま
	//   返すため、ここで id のホスト一致を確認することが重要）
	if (typeof object.id === "string") {
		if (extractDbHost(getApId(object)) !== extractDbHost(actor.uri!)) {
			return "skip: object host does not match actor host";
		}
	}

	if (isActor(object)) {
		await updatePerson(actor.uri!, resolver, object);
		return "ok: Person updated";
	}

	const objectType = getApType(object);

	if (
		objectType !== "Question" &&
		additionalTo &&
		[
			"Note",
			"Question",
			"Article",
			"Audio",
			"Document",
			"Image",
			"Page",
			"Video",
			"Event",
		].includes(objectType)
	) {
		const uri = getApId(object);
		const lock = await getApLock(uri);

		try {
			const exist = await fetchNote(object);
			if (exist && !(await Notes.isVisibleForMe(exist, additionalTo))) {
				await Notes.appendNoteVisibleUser(actor, exist, additionalTo);
				return "ok: note visible user appended";
			} else {
				return "skip: nothing to do";
			}
		} catch (err) {
			if (err instanceof StatusError && !err.isRetryable) {
				return `skip ${err.statusCode}`;
			} else {
				throw err;
			}
		} finally {
			await lock.release();
		}
	}

	switch (objectType) {
		case "Question":
		case "Note":
		case "Article":
		case "Document":
		case "Page":
			let failed = false;
			await updateNote(object, resolver).catch((e: Error) => {
				failed = true;
			});
			return failed ? "skip: Note update failed" : "ok: Note updated";

		default:
			return `skip: Unknown type: ${objectType}`;
	}
};
