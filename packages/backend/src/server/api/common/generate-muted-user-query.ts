/**
 * @packageDocumentation
 *
 * ノート・ユーザ一覧用のミュート条件を QueryBuilder に付与するヘルパー。
 *
 * @remarks
 * - **Muted**: me がミュートしているユーザ（mutee）の投稿を表示しない。さらに UserProfiles.mutedInstances によるインスタンスミュートも考慮する。
 * - generateMutedUserQuery:
 *   - 作者: `all` で除外。`note`（all|note）でも除外するが、本人の純粋RTは例外（`renote` スコープ担当）。
 *   - 返信先・RT先（引用元）: `note`（all|note）で除外。他人がミュート対象の投稿をRTしても見えないようにする。
 *   - 加えて note.userHost 等が mutedInstances に含まれないようにする。
 * - generateMutedUserQueryForUsers: ユーザ一覧で、me がミュートしているユーザを除外する。
 */
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";
import type { User } from "@/models/entities/user.js";
import { Mutings, UserProfiles } from "@/models/index.js";
import { ADMIN_USER_ID } from "@/const.js";
import {
	createMuteScopeCondition,
	MUTE_SCOPE_BITS,
} from "@/misc/mute-scope.js";

export function generateMutedUserQuery(
	q: SelectQueryBuilder<any>,
	me: { id: User["id"] },
	exclude?: User,
) {
	const allMutingQuery = Mutings.createQueryBuilder("all_muting")
		.select("all_muting.muteeId")
		.where("all_muting.muterId = :muterId", { muterId: me.id })
		.andWhere(`(all_muting."scope" & ${MUTE_SCOPE_BITS.all}) <> 0`);
	const noteMutingQuery = Mutings.createQueryBuilder("note_muting")
		.select("note_muting.muteeId")
		.where("note_muting.muterId = :muterId", { muterId: me.id })
		.andWhere(createMuteScopeCondition("note_muting", "note"));

	if (exclude) {
		allMutingQuery.andWhere("all_muting.muteeId != :excludeId", {
			excludeId: exclude.id,
		});
		noteMutingQuery.andWhere("note_muting.muteeId != :excludeId", {
			excludeId: exclude.id,
		});
	}

	const mutingInstanceQuery = UserProfiles.createQueryBuilder("user_profile")
		.select("user_profile.mutedInstances")
		.where("user_profile.userId = :muterId", { muterId: me.id });

	// 同一サブクエリを 1 回だけ生成して再利用し、重複評価を避ける
	const allMutingSubquery = allMutingQuery.getQuery();
	const noteMutingSubquery = noteMutingQuery.getQuery();
	const mutingInstanceSubquery = mutingInstanceQuery.getQuery();

	// 投稿の作者をミュートしていない かつ
	// 投稿の返信先の作者を note（all|note）ミュートしていない かつ
	// 投稿の引用元（RT先）の作者を note（all|note）ミュートしていない
	q.andWhere(new Brackets((qb) => {
		qb.where(new Brackets((normalMute) => {
			normalMute
				.where(`note.userId NOT IN (${allMutingSubquery})`)
				.andWhere(new Brackets((noteMute) => {
					noteMute
						// 本人の純粋RTは note ミュート対象外（renote スコープで隠す）
						.where("note.renoteId IS NOT NULL AND note.text IS NULL")
						.orWhere(`note.userId NOT IN (${noteMutingSubquery})`);
				}));
		})).orWhere("(note.visibility = 'specified' AND note.userId = :adminUserId)");
	}))
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.replyUserId IS NULL").orWhere(
					`note.replyUserId NOT IN (${noteMutingSubquery})`,
				);
			}),
		)
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteUserId IS NULL").orWhere(
					`note.renoteUserId NOT IN (${noteMutingSubquery})`,
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
		...allMutingQuery.getParameters(),
		...noteMutingQuery.getParameters(),
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
		.where("muting.muterId = :muterId", { muterId: me.id })
		.andWhere(`(muting."scope" & ${MUTE_SCOPE_BITS.all}) <> 0`);

	const mutingSubquery = mutingQuery.getQuery();
	q.andWhere(`user.id NOT IN (${mutingSubquery})`);

	q.setParameters(mutingQuery.getParameters());
}
