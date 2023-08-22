import type { CacheableRemoteUser } from "@/models/entities/user.js";
import type { ILike } from "../../type.js";
import { getApId } from "../../type.js";
import deleteReaction from "@/services/note/reaction/delete.js";
import { fetchNote } from "../../models/note.js";

/**
 * Process Undo.Like activity
 */
export default async (actor: CacheableRemoteUser, activity: ILike) => {
	const targetUri = getApId(activity.object);

	const note = await fetchNote(targetUri);
	if (!note) return `skip: target note not found ${targetUri}`;
	
	const emoji = activity.object?.content;

	await deleteReaction(actor, note, emoji).catch((e) => {
		if (e.id === "60527ec9-b4cb-4a88-a6bd-32d3ad26817d") return;
		throw e;
	});

	return "ok";
};
