/**
 * @packageDocumentation
 *
 * ノート・ユーザ一覧用のブロック条件を QueryBuilder に付与するヘルパー。
 *
 * @remarks
 * - **Blocked（被ブロック）**: me が blockee であるような blocker を除外する。つまり「自分をブロックしているユーザの投稿は表示しない」。
 * - generateBlockedUserQuery: ノートの userId / replyUserId / renoteUserId が blocker に含まれないようにする。
 * - generateBlockQueryForUsers: ユーザ一覧で、me をブロックしている／me がブロックしているユーザを除外する。
 */
import type { User } from "@/models/entities/user.js";
import { Blockings } from "@/models/index.js";
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";

export function generateBlockedUserQuery(
	q: SelectQueryBuilder<any>,
	me: { id: User["id"] },
) {
	const blockingQuery = Blockings.createQueryBuilder("blocking")
		.select("blocking.blockerId")
		.where("blocking.blockeeId = :blockeeId", { blockeeId: me.id });

	// 同一サブクエリを 1 回だけ生成して再利用する
	const blockingSubquery = blockingQuery.getQuery();

	// 投稿の作者にブロックされていない かつ
	// 投稿の返信先の作者にブロックされていない かつ
	// 投稿の引用元の作者にブロックされていない
	q.andWhere(`note.userId NOT IN (${blockingSubquery})`)
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.replyUserId IS NULL").orWhere(
					`note.replyUserId NOT IN (${blockingSubquery})`,
				);
			}),
		)
		.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteUserId IS NULL").orWhere(
					`note.renoteUserId NOT IN (${blockingSubquery})`,
				);
			}),
		);

	q.setParameters(blockingQuery.getParameters());
}

export function generateBlockQueryForUsers(
	q: SelectQueryBuilder<any>,
	me: { id: User["id"] },
) {
	const blockingQuery = Blockings.createQueryBuilder("blocking")
		.select("blocking.blockeeId")
		.where("blocking.blockerId = :blockerId", { blockerId: me.id });

	const blockedQuery = Blockings.createQueryBuilder("blocking")
		.select("blocking.blockerId")
		.where("blocking.blockeeId = :blockeeId", { blockeeId: me.id });

	const blockingSubquery = blockingQuery.getQuery();
	const blockedSubquery = blockedQuery.getQuery();

	q.andWhere(`user.id NOT IN (${blockingSubquery})`);
	q.setParameters(blockingQuery.getParameters());

	q.andWhere(`user.id NOT IN (${blockedSubquery})`);
	q.setParameters(blockedQuery.getParameters());
}
