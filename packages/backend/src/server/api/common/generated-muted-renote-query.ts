/**
 * @packageDocumentation
 *
 * 純粋なRTだけを対象とする範囲付きミュート条件を付与する。
 *
 * @internal
 */
import { Brackets, SelectQueryBuilder } from "typeorm";
import { User } from "@/models/entities/user.js";
import { Mutings } from "@/models/index.js";
import { createMuteScopeCondition } from "@/misc/mute-scope.js";

export function generateMutedUserRenotesQueryForNotes(
	q: SelectQueryBuilder<any>,
	me: { id: User["id"] },
): void {
	const mutingQuery = Mutings.createQueryBuilder("renote_muting")
		.select("renote_muting.muteeId")
		.where("renote_muting.muterId = :muterId", { muterId: me.id })
		.andWhere(createMuteScopeCondition("renote_muting", "renote"));

	q.andWhere(
		new Brackets((qb) => {
			qb.where(
				new Brackets((qb) => {
					qb.where("note.renoteId IS NOT NULL");
					qb.andWhere("note.text IS NULL");
					qb.andWhere(`note.userId NOT IN (${mutingQuery.getQuery()})`);
				}),
			)
				.orWhere("note.renoteId IS NULL")
				.orWhere("note.text IS NOT NULL");
		}),
	);

	q.setParameters(mutingQuery.getParameters());
}
