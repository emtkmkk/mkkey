import type { User } from "@/models/entities/user.js";
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";
import { createFollowingExistsCondition } from "./following-exists-condition.js";

export function generateVisibilityQuery(
	q: SelectQueryBuilder<any>,
	me?: { id: User["id"] } | null,
) {
	// This code must always be synchronized with the checks in Notes.isVisibleForMe.
	if (me == null) {
		q.andWhere(
			new Brackets((qb) => {
				qb.where(`note.visibility = 'public'`).orWhere(
					`note.visibility = 'home'`,
				);
			}),
		).andWhere(`note.localOnly = false`);
        } else {
                const followingCondition = createFollowingExistsCondition(me.id, {
                        parameterName: "visibilityFollowerId",
                        alias: "following_visibility",
                });

                q.andWhere(
                        new Brackets((qb) => {
				qb
					// 公開投稿である
					.where(
						new Brackets((qb) => {
							qb.where(`note.visibility = 'public'`).orWhere(
								`note.visibility = 'home'`,
							);
						}),
					)
					// または 自分自身
					.orWhere("note.userId = :meId")
					// または 自分宛て
					.orWhere(":meIdAsList <@ note.visibleUserIds")
					.orWhere(":meIdAsList <@ note.ccUserIds")
					.orWhere(":meIdAsList <@ note.mentions")
					.orWhere(
						new Brackets((qb) => {
							qb
                                                                // または フォロワー宛ての投稿であり、
                                                                .where(`note.visibility = 'followers'`)
                                                                .andWhere(
                                                                        new Brackets((qb) => {
                                                                                qb
                                                                                        // 自分がフォロワーである
                                                                                        .where(
                                                                                                followingCondition.clause(
                                                                                                        "note.userId",
                                                                                                ),
                                                                                        )
                                                                                        // または 自分の投稿へのリプライ
                                                                                        .orWhere("note.replyUserId = :meId");
                                                                        }),
                                                                );
                                                }),
                                        );
                        }),
                );

                q.setParameters({
                        meId: me.id,
                        meIdAsList: [me.id],
                        ...followingCondition.parameters,
                });
        }
}
