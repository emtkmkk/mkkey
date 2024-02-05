import type { CacheableRemoteUser } from "@/models/entities/user.js";
import type { ILike } from "../../type.js";
import { getApId } from "../../type.js";
import deleteReaction from "@/services/note/reaction/delete.js";
import { fetchNote, extractEmojis } from "../../models/note.js";
import config from "@/config/index.js";

/**
 * Process Undo.Like activity
 */
export default async (actor: CacheableRemoteUser, activity: ILike) => {
	const targetUri = getApId(activity.object);

	const note = await fetchNote(targetUri);
	if (!note) return `skip: target note not found ${targetUri}`;

	const react = activity._misskey_reaction || activity.content || activity.name;
	const reactName = react?.split("@")?.[0];
	const reactHost = react?.split("@")?.[1] ?? undefined;

	const emoji = await extractEmojis(activity.tag || [], actor.host).catch(
		() => null,
	);
	const reactEmoji = emoji?.filter(
		(x) =>
			x.name === reactName &&
			(!reactHost || (x.host ?? config.host) === reactHost),
	);

	await deleteReaction(
		actor,
		note,
		reactName + (reactEmoji?.[0]?.host ? `@${reactEmoji[0].host}` : ""),
	).catch((e) => {
		if (e.id === "60527ec9-b4cb-4a88-a6bd-32d3ad26817d") return;
		throw e;
	});

	return "ok";
};
