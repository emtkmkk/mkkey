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
