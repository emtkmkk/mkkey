import type Resolver from "../../resolver.js";
import type {
	CacheableRemoteUser,
	ILocalUser,
} from "@/models/entities/user.js";
import { createNote, fetchNote } from "../../models/note.js";
import type { IObject, ICreate } from "../../type.js";
import { getApId } from "../../type.js";
import { getApLock } from "@/misc/app-lock.js";
import { extractDbHost } from "@/misc/convert-host.js";
import { StatusError } from "@/misc/fetch.js";
import { Notes } from "@/models/index.js";

/**
 * Handle post creation activity
 */
export default async function (
	resolver: Resolver,
	actor: CacheableRemoteUser,
	note: IObject,
	silent = false,
	activity?: ICreate,
	additionalTo?: ILocalUser["id"],
): Promise<string> {
	const uri = getApId(note);

	if (typeof note === "object") {
		if (actor.uri !== note.attributedTo) {
			return "skip: actor.uri !== note.attributedTo";
		}

		if (typeof note.id === "string") {
			if (extractDbHost(actor.uri) !== extractDbHost(note.id)) {
				return "skip: host in actor.uri !== note.id";
			}
		}
	}

	const lock = await getApLock(uri);

	try {
		const exist = await fetchNote(note);
		if (
			additionalTo &&
			exist &&
			!(await Notes.isVisibleForMe(exist, additionalTo))
		) {
			await Notes.appendNoteVisibleUser(actor, exist, additionalTo);
			return "ok: note visible user appended";
		} else if (exist) {
			return "skip: note exists";
		}

		await createNote(note, resolver, silent, additionalTo);
		return "ok";
	} catch (e) {
		if (e instanceof StatusError && !e.isRetryable) {
			return `skip ${e.statusCode}`;
		} else {
			throw e;
		}
	} finally {
		await lock.release();
	}
}
