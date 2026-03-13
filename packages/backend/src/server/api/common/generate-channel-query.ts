/**
 * @packageDocumentation
 *
 * チャンネル（タグ）に基づくノートの可視条件をクエリに付与する。
 *
 * @remarks
 * - **役割**: ノート一覧系エンドポイントで、チャンネル所属に応じた WHERE 条件を QueryBuilder に付与する。
 *
 * @see {@link generate-visibility-query} 可視性条件
 * @internal
 */
import type { User } from "@/models/entities/user.js";
import { ChannelFollowings } from "@/models/index.js";
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";

export function generateChannelQuery(
	q: SelectQueryBuilder<any>,
	me?: { id: User["id"] } | null,
) {
	// TODO チャンネル所属関係なく全員に見えるようにする、フォローしているタグ名と等しいハッシュタグを取得する
	/*
	if (me == null) {
		q.andWhere("note.channelId IS NULL");
	} else {
		q.leftJoinAndSelect("note.channel", "channel");

		const channelFollowingQuery = ChannelFollowings.createQueryBuilder(
			"channelFollowing",
		)
			.select("channelFollowing.followeeId")
			.where("channelFollowing.followerId = :followerId", {
				followerId: me.id,
			});

		q.andWhere(
			new Brackets((qb) => {
				qb
					// チャンネルのノートではない
					.where("note.channelId IS NULL")
					// または自分がフォローしているチャンネルのノート
					.orWhere(`note.channelId IN (${channelFollowingQuery.getQuery()})`);
			}),
		);

		q.setParameters(channelFollowingQuery.getParameters());
	}
	*/
}
