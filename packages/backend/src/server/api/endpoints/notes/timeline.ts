/**
 * @packageDocumentation
 *
 * ホームタイムライン（フォロー先のノート）を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/timeline`（GET `/api/notes/timeline` で呼び出し）
 * - 認証必須。フォローしているユーザーのノートを時系列で取得する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { Notes, Followings } from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";
import { ApiError } from "../../error.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";
import { applyOrWhereNoteHasContent } from "../../common/note-content-condition.js";

export const meta = {
	tags: ["notes"],

	requireCredential: true,

	description:
		"ホームタイムラインを取得する。フォローしているユーザーの投稿を時系列で返す。sinceId/untilId/limit でページネーション可能。含める・除外する投稿の条件（返信、ファイル付きなど）を指定できる。",

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

	errors: {
		queryError: {
			message: "フォロー数を増やしてください。",
			code: "QUERY_ERROR",
			id: "620763f4-f621-4533-ab33-0577a1a3c343",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
		sinceId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より新しいものだけ取得する場合に指定。",
		},
		untilId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より古いものだけ取得する場合に指定。",
		},
		sinceDate: {
			type: "integer",
			description: "この日時（Unix ミリ秒）より新しいものだけ取得する場合に指定。",
		},
		untilDate: {
			type: "integer",
			description: "この日時（Unix ミリ秒）より古いものだけ取得する場合に指定。",
		},
		includeMyRenotes: {
			type: "boolean",
			default: true,
			description: "自分のリノートを含めるか。",
		},
		includeRenotedMyNotes: {
			type: "boolean",
			default: true,
			description: "自分の投稿のリノートを含めるか。",
		},
		includeLocalRenotes: {
			type: "boolean",
			default: true,
			description: "ローカルユーザーのリノートを含めるか。",
		},
		withFiles: {
			type: "boolean",
			default: false,
			description: "true のとき、ファイルが添付された投稿のみ返します。",
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
        const hasFollowing = await Followings.exist({
                where: {
                        followerId: user.id,
                },
        });

	//#region クエリ構築
        const followingCondition = createFollowingExistsCondition(user.id);

        const query = makePaginationQuery(
                Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere(
			new Brackets((qb) => {
                                qb.where("note.userId = :meId", { meId: user.id });
                                if (hasFollowing)
                                        qb.orWhere(followingCondition.clause("note.userId"));
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
                .leftJoinAndSelect("renoteUser.banner", "renoteUserBanner")
                .setParameters(followingCondition.parameters);

        generateChannelQuery(query, user);
        generateRepliesQuery(query, user, followingCondition);
	generateVisibilityQuery(query, user);
	generateMutedUserQuery(query, user);
	generateMutedNoteQuery(query, user);
	generateBlockedUserQuery(query, user);
	generateMutedUserRenotesQueryForNotes(query, user);

	if (user && !user.showSelfRenoteToHome) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.renoteUserId != note.userId");
				qb.orWhere("note.userId = :meId", { meId: user.id });
				qb.orWhere("note.renoteId IS NULL");
				applyOrWhereNoteHasContent(qb, "note");
			}),
		);
	}

	if (ps.includeMyRenotes === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.userId != :meId", { meId: user.id });
				qb.orWhere("note.renoteId IS NULL");
				applyOrWhereNoteHasContent(qb, "note");
			}),
		);
	}

	if (ps.includeRenotedMyNotes === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.renoteUserId != :meId", { meId: user.id });
				qb.orWhere("note.renoteId IS NULL");
				applyOrWhereNoteHasContent(qb, "note");
			}),
		);
	}

	if (ps.includeLocalRenotes === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.renoteUserHost IS NOT NULL");
				qb.orWhere("note.renoteId IS NULL");
				applyOrWhereNoteHasContent(qb, "note");
			}),
		);
	}

        if (ps.withFiles) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
        }

	query.andWhere("note.visibility != 'hidden'");
	//#endregion

	process.nextTick(() => {
		activeUsersChart.read(user);
	});

	// フィルタで除外されるため要求より多めに取得し、件数が不足するとページネーションを打ち切る。
	const found = [];
	const take = Math.floor(ps.limit * 1.5);
	let skip = 0;
	try {
		while (found.length < ps.limit) {
			const notes = await query.take(take).skip(skip).getMany();
			const { userMap, noteMap } = buildUserAndNoteMapsFromNotes(notes);
			found.push(
				...(await Notes.packMany(notes, user, {
					_hint_: { userMap, noteMap },
				})),
			);
			skip += take;
			if (notes.length < take) break;
		}
	} catch (error) {
		throw new ApiError(meta.errors.queryError);
	}

	if (found.length > ps.limit) {
		found.length = ps.limit;
	}

	return found;
});
