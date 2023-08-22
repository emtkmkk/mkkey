import { publishNoteStream } from "@/services/stream.js";
import { renderLike } from "@/remote/activitypub/renderer/like.js";
import renderUndo from "@/remote/activitypub/renderer/undo.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import DeliverManager from "@/remote/activitypub/deliver-manager.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import type { User, IRemoteUser } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
import { NoteReactions, Users, Notes } from "@/models/index.js";
import { decodeReaction } from "@/misc/reaction-lib.js";

export default async (
	user: { id: User["id"]; host: User["host"] },
	note: Note,
	emoji?: any,
) => {
	const existCount = await NoteReactions.count({
		where: {
			noteId: note.id,
			userId: user.id,
		}
	});

	if (emoji == null && existCount > 1) {
		throw new IdentifiableError(
			"60527ec9-b4cb-4a88-a6bd-32d3ad26817d",
			"Unable to process due to multiple targets",
		);
	}

	// if already unreacted
	const exist = await NoteReactions.findOneBy({
		noteId: note.id,
		userId: user.id,
		...(emoji ? { reaction: emoji } : {}),
	});

	if (exist == null) {
		throw new IdentifiableError(
			"60527ec9-b4cb-4a88-a6bd-32d3ad26817d",
			"not reacted",
		);
	}

	// Delete reaction
	const result = await NoteReactions.delete(exist.id);

	if (result.affected !== 1) {
		throw new IdentifiableError(
			"60527ec9-b4cb-4a88-a6bd-32d3ad26817d",
			"not reacted",
		);
	}

	// Decrement reactions count
	const sql = `jsonb_set("reactions", '{${exist.reaction}}', (COALESCE("reactions"->>'${exist.reaction}', '0')::int - 1)::text::jsonb)`;

	await Notes.createQueryBuilder()
		.update()
		.set({
			reactions: () => sql,
		})
		.where("id = :id", { id: note.id })
		.execute();

	if (existCount === 1) {
		Notes.decrement({ id: note.id }, "score", (user.host ? '1' : '3'));
	}

	publishNoteStream(note.id, "unreacted", {
		reaction: decodeReaction(exist.reaction).reaction,
		userId: user.id,
	});

	//#region 配信
	if (Users.isLocalUser(user) && !(note.channelId && note.localOnly)) {
		const content = renderActivity(
			renderUndo(await renderLike(exist, note), user),
		);
		const dm = new DeliverManager(user, content);
		if (note.userHost !== null) {
			const reactee = await Users.findOneBy({ id: note.userId });
			dm.addDirectRecipe(reactee as IRemoteUser);
		}
		dm.addFollowersRecipe();
		dm.execute();
	}
	//#endregion
};
