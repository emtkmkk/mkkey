import type { User } from "@/models/entities/user.js";
import type { SelectQueryBuilder } from "typeorm";
import { Brackets } from "typeorm";
import type { FollowingExistsCondition } from "./following-exists-condition.js";

/**
 * TL用の「返信として扱う/扱わない」条件をクエリに追加する。
 *
 * @remarks
 * - applyIsBotMentionFilter が true のときのみ、note.isBotMention を「Botが関わる返信」として扱う。
 *   呼び出し元では showReplyMode === "notBotOnly"（Botが関わる返信を表示しない）のときだけ true を渡す。
 * - その場合、自分の投稿（note.userId = me.id）は isBotMention の有無にかかわらず表示する。
 * - `me.showTimelineReplies` は認証ユーザに必ず載せること。未設定の undefined は「TL に返信を載せない」既定（false）に合わせ `!== true` で扱う。
 */
export function generateRepliesQuery(
        q: SelectQueryBuilder<any>,
        me?: Pick<User, "id" | "showTimelineReplies"> | null,
        following?: FollowingExistsCondition | null,
        mode?: "all" | "notBotOnly" | "personalOnly",
        applyIsBotMentionFilter?: boolean
) {
	const useBotMention = applyIsBotMentionFilter === true;
	const notReplyCond = useBotMention
		? "(note.replyId IS NULL AND (note.isBotMention IS NOT TRUE))"
		: "note.replyId IS NULL";

	if (me == null) {
		q.andWhere(
			new Brackets((qb) => {
				qb.where(notReplyCond)
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
        } else if (me.showTimelineReplies !== true) {
                if (following != null) {
                        q.andWhere(
                                new Brackets((qb) => {
                                        if (useBotMention) {
                                                qb.orWhere("note.userId = :meId", { meId: me.id }); // 自分の投稿は isBotMention でも表示
                                        }
                                        qb.orWhere(notReplyCond)
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
                                                                                        if (useBotMention) {
                                                                                                qb.andWhere("note.isBotMention IS NOT TRUE");
                                                                                        }
                                                                                }
								}),
							);
						}
				}),
			);
		} else {
			q.andWhere(
				new Brackets((qb) => {
					if (useBotMention) {
						qb.orWhere("note.userId = :meId", { meId: me.id }); // 自分の投稿は isBotMention でも表示
					}
					qb.orWhere(notReplyCond)
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
