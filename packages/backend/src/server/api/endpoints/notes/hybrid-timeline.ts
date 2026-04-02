/**
 * @packageDocumentation
 *
 * ハイブリッドタイムライン（ホーム＋グローバル混在）を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/hybrid-timeline`（GET `/api/notes/hybrid-timeline` で呼び出し）
 * - 認証必須。フォロー先とグローバルを混在させたタイムラインを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Followings, Notes } from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { rethrowTimelineQueryAsApiError } from "../../common/rethrow-timeline-query-error.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";
import { applyOrWhereNoteHasContent } from "../../common/note-content-condition.js";
import { applyPublicTimelineWarnedUserFilter } from "../../common/generate-public-timeline-warned-user-filter.js";

export const meta = {
	tags: ["notes"],
	requireCredentialPrivateMode: true,

	description:
		"ハイブリッドタイムラインを取得する。フォロー先の投稿とグローバルの投稿を混在させた時系列で返す。sinceId/untilId/limit でページネーション可能。",

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
		stlDisabled: {
			message: "STLは無効化されています。",
			code: "STL_DISABLED",
			id: "620763f4-f621-4533-ab33-0577a1a3c342",
		},
		queryError: {
			message:
				"タイムラインの取得に失敗しました。時間をおいて再度お試しください。",
			code: "QUERY_ERROR",
			id: "620763f4-f621-4533-ab33-0577a1a3c343",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
		includeMyRenotes: { type: "boolean", default: true },
		includeRenotedMyNotes: { type: "boolean", default: true },
		includeLocalRenotes: { type: "boolean", default: true },
		withFiles: {
			type: "boolean",
			default: false,
			description: "true のとき、ファイルが添付されたノートのみ返します。",
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const m = await fetchMeta();
	if (m.disableLocalTimeline && !user.isAdmin && !user.isModerator) {
		throw new ApiError(meta.errors.stlDisabled);
	}

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
                                qb.where(
                                        new Brackets((qb) => {
                                                qb.where(
                                                        followingCondition.clause("note.userId"),
                                                ).orWhere("note.userId = :meId", { meId: user.id });
                                        }),
                                ).orWhere(
                `(note.visibility = 'public') AND (note.userHost IS NULL OR note.userHost = ANY (:recommendedHosts))`,
                { recommendedHosts: m.recommendedInstances },
            )
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

	await applyPublicTimelineWarnedUserFilter(query, user, {
		socialFollowingException: true,
	});

	if (user && user.showSelfRenoteToHome === false) {
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
		rethrowTimelineQueryAsApiError(
			"notes/hybrid-timeline",
			meta.errors.queryError,
			error,
		);
	}

	if (found.length > ps.limit) {
		found.length = ps.limit;
	}

	return found;
});
