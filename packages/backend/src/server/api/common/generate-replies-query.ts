import type { User } from "@/models/entities/user.js";
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";
import type { FollowingExistsCondition } from "./following-exists-condition.js";

/**
 * TL用の「返信として扱う/扱わない」条件をクエリに追加する。
 *
 * @remarks
 * - note.isBotMention が true の投稿は、replyId がなくても「Botが関わる返信」として扱い、
 *   「返信ではない」条件では通さない（notBotOnly 時も同様に除外）。
 */
export function generateRepliesQuery(
        q: SelectQueryBuilder<any>,
        me?: Pick<User, "id" | "showTimelineReplies"> | null,
        following?: FollowingExistsCondition | null,
        mode?: "all" | "notBotOnly" | "personalOnly"
) {
	if (me == null) {
		q.andWhere(
			new Brackets((qb) => {
				// 返信ではない（isBotMention は Bot が関わる返信として扱うため、true のときはここに含めない）
				qb.where(
					"(note.replyId IS NULL AND (note.isBotMention IS NOT TRUE))",
				)
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
                                        // 返信ではない（isBotMention は Bot が関わる返信として扱う）
                                        qb.where(
                                                "(note.replyId IS NULL AND (note.isBotMention IS NOT TRUE))",
                                        )
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
                                                                                        qb.andWhere("note.isBotMention IS NOT TRUE")
                                                                                }
								}),
							);
						}
				}),
			);
		} else {
			q.andWhere(
				new Brackets((qb) => {
					// 返信ではない（isBotMention は Bot が関わる返信として扱う）
					qb.where(
						"(note.replyId IS NULL AND (note.isBotMention IS NOT TRUE))",
					)
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
