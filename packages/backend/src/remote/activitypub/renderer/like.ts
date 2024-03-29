import { IsNull } from "typeorm";
import config from "@/config/index.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";
import type { Note } from "@/models/entities/note.js";
import { Emojis } from "@/models/index.js";
import renderEmoji from "./emoji.js";
import { fetchMeta } from "@/misc/fetch-meta.js";

export const renderLike = async (noteReaction: NoteReaction, note: Note) => {
	const reaction = noteReaction.reaction;
	const custom = reaction.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/) || null;
	const sendReaction = custom
		? custom[2]
			? `:${reaction?.match(/[^:@]+/)?.[0]}:`
			: reaction
		: reaction;
	const meta = await fetchMeta();

	const object = {
		type: "Like",
		id: `${config.url}/likes/${noteReaction.id}`,
		actor: `${config.url}/users/${noteReaction.userId}`,
		object: note.uri ? note.uri : `${config.url}/notes/${noteReaction.noteId}`,
		...(!meta.defaultReaction.includes(reaction)
			? {
					content: sendReaction,
					_misskey_reaction: sendReaction,
			  }
			: {}),
	} as any;

	if (reaction.startsWith(":")) {
		const name = custom[1];
		const host = custom[2] == "." ? IsNull() : custom[2] || IsNull();
		const emoji = await Emojis.findOneBy({
			name,
			host,
		});

		if (emoji) object.tag = [renderEmoji(emoji)];
	}

	return object;
};
