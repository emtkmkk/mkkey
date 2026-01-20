import renderUpdate from "@/remote/activitypub/renderer/update.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderNote from "@/remote/activitypub/renderer/note.js";
import { Users, Notes, Polls } from "@/models/index.js";
import type { Note } from "@/models/entities/note.js";
import type { Poll } from "@/models/entities/poll.js";
import { deliverToFollowers } from "@/remote/activitypub/deliver-manager.js";
import { deliverToRelays } from "../../relay.js";

export async function deliverQuestionUpdate(noteId: Note["id"]) {
	const note = await Notes.findOneBy({ id: noteId });
	if (note == null) throw new Error("note not found");

	const user = await Users.findOneBy({ id: note.userId });
	if (user == null) throw new Error("user not found");

	if (Users.isLocalUser(user)) {
		let pollOverride: { pollOverride?: Poll | null } | undefined;
		if (note.hasPoll) {
			const poll = await Polls.findOneBy({ noteId: note.id });
			if (poll?.hideResults) {
				const now = new Date();
				if (poll.expiresAt == null || poll.expiresAt > now) {
					pollOverride = {
						pollOverride: {
							...poll,
							votes: poll.votes.map(() => 0),
						},
					};
				}
			}
		}
		const content = renderActivity(
			renderUpdate(await renderNote(note, false, false, pollOverride), user),
		);
		deliverToFollowers(user, content);
		deliverToRelays(user, content);
	}
}
