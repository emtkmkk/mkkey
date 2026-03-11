/**
 * @packageDocumentation
 *
 * ノート・ユーザ一覧用のミュート条件を QueryBuilder に付与するヘルパー。
 *
 * @remarks
 * - **Muted**: me がミュートしているユーザ（mutee）の投稿を表示しない。さらに UserProfiles.mutedInstances によるインスタンスミュートも考慮する。
 * - generateMutedUserQuery: ノートの userId / replyUserId / renoteUserId がミュート対象でなく、かつ note.userHost 等が mutedInstances に含まれないようにする。
 * - generateMutedUserQueryForUsers: ユーザ一覧で、me がミュートしているユーザを除外する。
 */
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";
import type { User } from "@/models/entities/user.js";
import { Mutings, UserProfiles } from "@/models/index.js";
import { ADMIN_USER_ID } from "@/const.js";

export function generateMutedUserQuery(
	q: SelectQueryBuilder<any>,
	me: { id: User["id"] },
	exclude?: User,
) {
	const mutingQuery = Mutings.createQueryBuilder("muting")
		.select("muting.muteeId")
		.where("muting.muterId = :muterId", { muterId: me.id });

	if (exclude) {
		mutingQuery.andWhere("muting.muteeId != :excludeId", {
			excludeId: exclude.id,
		});
	}

	const mutingInstanceQuery = UserProfiles.createQueryBuilder("user_profile")
		.select("user_profile.mutedInstances")
		.where("user_profile.userId = :muterId", { muterId: me.id });

	// 同一サブクエリを 1 回だけ生成して再利用し、重複評価を避ける
	const mutingSubquery = mutingQuery.getQuery();
	const mutingInstanceSubquery = mutingInstanceQuery.getQuery();

	// 投稿の作者をミュートしていない かつ
	// 投稿の返信先の作者をミュートしていない かつ
	// 投稿の引用元の作者をミュートしていない
	q.andWhere(
		`(note.userId NOT IN (${mutingSubquery}) OR (note.visibility = 'specified' AND note.userId = :adminUserId))`,
	)
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.replyUserId IS NULL").orWhere(
					`note.replyUserId NOT IN (${mutingSubquery})`,
				);
			}),
		)
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteUserId IS NULL").orWhere(
					`note.renoteUserId NOT IN (${mutingSubquery})`,
				);
			}),
		)
		// mute instances
		.andWhere(
			new Brackets((qb) => {
				qb.andWhere("note.userHost IS NULL").orWhere(
					`NOT ((${mutingInstanceSubquery})::jsonb ? note.userHost)`,
				);
			}),
		)
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.replyUserHost IS NULL").orWhere(
					`NOT ((${mutingInstanceSubquery})::jsonb ? note.replyUserHost)`,
				);
			}),
		)
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteUserHost IS NULL").orWhere(
					`NOT ((${mutingInstanceSubquery})::jsonb ? note.renoteUserHost)`,
				);
			}),
		);

	q.setParameters({
		...mutingQuery.getParameters(),
		...mutingInstanceQuery.getParameters(),
		adminUserId: ADMIN_USER_ID,
	});
}

export function generateMutedUserQueryForUsers(
	q: SelectQueryBuilder<any>,
	me: { id: User["id"] },
) {
	const mutingQuery = Mutings.createQueryBuilder("muting")
		.select("muting.muteeId")
		.where("muting.muterId = :muterId", { muterId: me.id });

	const mutingSubquery = mutingQuery.getQuery();
	q.andWhere(`user.id NOT IN (${mutingSubquery})`);

	q.setParameters(mutingQuery.getParameters());
}
