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

/**
 * Handler for the Update activity
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
