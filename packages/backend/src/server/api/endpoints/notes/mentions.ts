/**
 * @packageDocumentation
 *
 * 認証ユーザーへのメンション付きノート一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/mentions`（GET `/api/notes/mentions` で呼び出し）
 * - 認証必須。自分宛てのメンションを含むノートをページネーションで取得する。
 * CHANGED: 本家 Misskey 互換のため `kind: read:account` を追加し、アプリトークンからの利用を許可する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import read from "@/services/note/read.js";
import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { fetchPackedNotesWithOverfetch } from "../../common/fetch-packed-notes-with-overfetch.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedNoteThreadQuery } from "../../common/generate-muted-note-thread-query.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";

export const meta = {
	tags: ["notes"],

	requireCredential: true,
	kind: "read:account",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "Note",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		following: { type: "boolean", default: false },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		visibility: { type: "string" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
        const followingCondition = createFollowingExistsCondition(user.id);

	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere(
			new Brackets((qb) => {
				qb.where(`'{"${user.id}"}' <@ note.mentions`).orWhere(
					`'{"${user.id}"}' <@ note.visibleUserIds`,
				);
				if (ps.visibility === "specified") {
					qb.orWhere(
						"(note.userId = :userId AND note.visibility = 'specified' AND note.visibleUserIds = '{}' AND note.ccUserIds = '{}')",
						{ userId: user.id },
					);
				}
			}),
		)
		.innerJoinAndSelect("note.user", "user")
		.leftJoinAndSelect("user.avatar", "avatar")
		.leftJoinAndSelect("user.banner", "banner")
		.leftJoinAndSelect("note.reply", "reply")
		.leftJoinAndSelect("note.renote", "renote")
		.leftJoinAndSelect("reply.user", "replyUser")
		.leftJoinAndSelect("replyUser.avatar", "replyUserAvatar")
		.leftJoinAndSelect("replyUser.banner", "replyUserBanner")
		.leftJoinAndSelect("renote.user", "renoteUser")
		.leftJoinAndSelect("renoteUser.avatar", "renoteUserAvatar")
		.leftJoinAndSelect("renoteUser.banner", "renoteUserBanner");

	generateVisibilityQuery(query, user);
	generateMutedUserQuery(query, user);
	generateMutedNoteThreadQuery(query, user);
	generateBlockedUserQuery(query, user);

	if (ps.visibility) {
		query.andWhere("note.visibility = :visibility", {
			visibility: ps.visibility,
		});
	}

        if (ps.following) {
                query.andWhere(
                        new Brackets((qb) => {
                                qb.where(followingCondition.clause("note.userId")).orWhere(
                                        "note.userId = :meId",
                                        { meId: user.id },
                                );
                        }),
                );
                query.setParameters(followingCondition.parameters);
        }

	const found = await fetchPackedNotesWithOverfetch({
		query,
		limit: ps.limit,
		pagination: ps,
		me: user,
	});

	read(user.id, found);

	return found;
});
