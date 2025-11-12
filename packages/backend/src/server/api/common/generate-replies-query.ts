import type { User } from "@/models/entities/user.js";
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";
import type { FollowingExistsCondition } from "./following-exists-condition.js";

export function generateRepliesQuery(
        q: SelectQueryBuilder<any>,
        me?: Pick<User, "id" | "showTimelineReplies"> | null,
        following?: FollowingExistsCondition | null,
        mode?: "all" | "notBotOnly" | "personalOnly"
) {
	if (me == null) {
		q.andWhere(
			new Brackets((qb) => {
				qb.where("note.replyId IS NULL") // 返信ではない
					.orWhere(
						new Brackets((qb) => {
							qb.where(
								// 返信だけど投稿者自身への返信
								"note.replyId IS NOT NULL",
							)
								.andWhere("(note.replyUserId = note.userId)")
								.andWhere(
									"((reply.replyUserId IS NULL) OR (reply.replyUserId = note.userId))",
								);
						}),
					);
			}),
		);
        } else if (!me.showTimelineReplies) {
                if (following != null) {
                        q.andWhere(
                                new Brackets((qb) => {
                                        qb.where("note.replyId IS NULL") // 返信ではない
                                                .orWhere("note.replyUserId = :meId", { meId: me.id }) // 返信だけど自分のノートへの返信
                                                .orWhere(
							new Brackets((qb) => {
								qb.where(
									// 返信だけど自分の行った返信
									"note.replyId IS NOT NULL",
								).andWhere("note.userId = :meId", { meId: me.id });
							}),
						)
                                                .orWhere(
                                                        new Brackets((qb) => {
                                                                qb.where(
                                                                        // 返信だけど投稿者自身への返信
                                                                        // ただし一つ前の投稿の返信へ遡ってチェックを行う
                                                                        "note.replyId IS NOT NULL",
                                                                )
                                                                        .andWhere("note.replyUserId = note.userId")
                                                                        .andWhere(
                                                                                new Brackets((qb) => {
                                                                                        qb.where("reply.replyUserId IS NULL")
                                                                                                .orWhere("reply.replyUserId = note.userId")
                                                                                                .orWhere(
                                                                                                        new Brackets((qb) => {
                                                                                                                qb.where(
                                                                                                                        following.clause(
                                                                                                                                "reply.replyUserId",
                                                                                                                        ),
                                                                                                                ).andWhere(
                                                                                                                        following.clause(
                                                                                                                                "note.userId",
                                                                                                                        ),
                                                                                                                );
                                                                                                        }),
                                                                                                );
                                                                                }),
                                                                        );
                                                        }),
                                                )
                                                if (mode !== "personalOnly") {
                                                        qb.orWhere(
                                                                new Brackets((qb) => {
                                                                        qb.where(
                                                                                // 返信だけどノート主、返信先をフォローしている
                                                                                "note.replyId IS NOT NULL",
                                                                        )
                                                                                .andWhere(
                                                                                        following.clause("note.replyUserId"),
                                                                                )
                                                                                .andWhere(
                                                                                        following.clause("note.userId"),
                                                                                );
                                                                                if (mode === "notBotOnly") {
                                                                                        qb.andWhere("replyUser.isBot = false")
                                                                                        qb.andWhere("user.isBot = false")
                                                                                }
								}),
							);
						}
				}),
			);
		} else {
			q.andWhere(
				new Brackets((qb) => {
					qb.where("note.replyId IS NULL") // 返信ではない
						.orWhere("note.replyUserId = :meId", { meId: me.id }) // 返信だけど自分のノートへの返信
						.orWhere(
							new Brackets((qb) => {
								qb.where(
									// 返信だけど自分の行った返信
									"note.replyId IS NOT NULL",
								).andWhere("note.userId = :meId", { meId: me.id });
							}),
						)
						.orWhere(
							new Brackets((qb) => {
								qb.where(
									// 返信だけど投稿者自身への返信
									"note.replyId IS NOT NULL",
								).andWhere("note.replyUserId = note.userId");
							}),
						);
				}),
			);
		}
	}
}
