import type { User } from "@/models/entities/user.js";
import { MutedNotes, NoteThreadMutings } from "@/models/index.js";
import type { SelectQueryBuilder } from "typeorm";

export function generateMutedNoteQuery(
	q: SelectQueryBuilder<any>,
	me: { id: User["id"] },
) {
	const mutedQuery = MutedNotes.createQueryBuilder("muted")
		.select("muted.noteId")
		.where("muted.userId = :userId", { userId: me.id });

	/*const threadMutedQuery = NoteThreadMutings.createQueryBuilder("threadMuted")
	.select("threadMuted.threadId")
	.where("threadMuted.userId = :userId", { userId: me.id });*/

	q.andWhere(`note.id NOT IN (${mutedQuery.getQuery()})`);

	q.setParameters(mutedQuery.getParameters());

	//q.andWhere(`COALESCE(renote.id," ") NOT IN (${threadMutedQuery.getQuery()})`);

	//q.setParameters(threadMutedQuery.getParameters());
}
