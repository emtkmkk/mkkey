import type { CacheableRemoteUser } from "@/models/entities/user.js";
import type { ILike } from "../type.js";
import { getApId } from "../type.js";
import create from "@/services/note/reaction/create.js";
import { fetchNote, extractEmojis } from "../models/note.js";

export default async (actor: CacheableRemoteUser, activity: ILike) => {
	const targetUri = getApId(activity.object);

	const note = await fetchNote(targetUri);
	if (!note) return `skip: target note not found ${targetUri}`;
	
	const react = activity._misskey_reaction || activity.content || activity.name;
	const reactName = react?.split("@")?.[0];
	const reactHost = react?.split("@")?.[1] ?? undefined;
	
	const emoji = await extractEmojis(activity.tag || [], actor.host).catch(() => null);
	const reactEmoji = emoji?.length === 1 ? emoji : emoji?.filter((x) => x.name === reactName && (!reactHost || (x.host ?? "mkkey.net") === reactHost));
	
	return await create(
		actor,
		note,
		`:${reactEmoji?.[0]?.name + (reactEmoji?.[0]?.host ? "@" + reactEmoji[0].host : "")}:`,
	)
		.catch((e) => {
			if (e.id === "51c42bb4-931a-456b-bff7-e5a8a70dd298") {
				return "skip: already reacted";
			} else {
				throw e;
			}
		})
		.then(() => "ok");
};
