/**
 * アンケートの更新を通常フォロワーと購読済みローカルリレーへ配送する。
 * @remarks NOTE: 追加のリレー配送は public/home のみ。非公開チャンネルは配送しない。
 * @packageDocumentation
 * @internal
 */
import renderUpdate from "@/remote/activitypub/renderer/update.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderNote from "@/remote/activitypub/renderer/note.js";
import { Users, Notes, Polls } from "@/models/index.js";
import type { Note } from "@/models/entities/note.js";
import type { Poll } from "@/models/entities/poll.js";
import DeliverManager, { deliverToInboxes } from "@/remote/activitypub/deliver-manager.js";
import { deliverToRelays } from "../../relay.js";
import { getLocalRelayInboxes } from "@/services/local-relay.js";

export async function deliverQuestionUpdate(noteId: Note["id"]) {
	const note = await Notes.findOneBy({ id: noteId });
	if (note == null) throw new Error("note not found");
	if (note.localOnly && note.channelId) return;

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
		const dm = new DeliverManager(user, content);
		dm.addFollowersRecipe();
		const inboxes = await dm.collectInboxes();
		for (const [inbox, shared] of await getLocalRelayInboxes(note)) inboxes.set(inbox, shared);
		await deliverToInboxes(user, content, inboxes);
		if (note.visibility === "public" && !note.localOnly) await deliverToRelays(user, content, new Set(inboxes.keys()));
	}
}
