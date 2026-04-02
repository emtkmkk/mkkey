/**
 * @packageDocumentation
 *
 * グローバルタイムライン（連合全体のノート）を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/global-timeline`（GET `/api/notes/global-timeline` で呼び出し）
 * - 認証不要。連合のパブリックノートを時系列で取得。withRenotes・withReplies 等で絞り込み可能。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Notes } from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { rethrowTimelineQueryAsApiError } from "../../common/rethrow-timeline-query-error.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";
import { applyPublicTimelineWarnedUserFilter } from "../../common/generate-public-timeline-warned-user-filter.js";

export const meta = {
	tags: ["notes"],

	requireCredentialPrivateMode: true,

	description:
		"グローバルタイムラインを取得する。連合全体のパブリック投稿を時系列で返す。sinceId/untilId/limit でページネーション可能。返信・リノート・ファイル付きなどの絞り込みができる。",

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
		gtlDisabled: {
			message: "GTLは無効化されています。",
			code: "GTL_DISABLED",
			id: "0332fc13-6ab2-4427-ae80-a9fadffd1a6b",
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
		withFiles: {
			type: "boolean",
			default: false,
			description: "true のとき、ファイルが添付されたノートのみ返します。",
		},
		showReplyMode: {
			type: "string",
			enum: ["all", "notBotOnly", "personalOnly"],
			default: "all",
		},
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const m = await fetchMeta();
	if (m.disableGlobalTimeline) {
		if (user == null || !(user.isAdmin || user.isModerator)) {
			throw new ApiError(meta.errors.gtlDisabled);
		}
	}

	//#region クエリ構築
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere("note.visibility = 'public'")
		.andWhere("note.channelId IS NULL")
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

        if (user) {
                const followingCondition = createFollowingExistsCondition(user.id);
                query.setParameters(followingCondition.parameters);
                generateRepliesQuery(query, user, followingCondition, ps.showReplyMode ?? "all", ps.showReplyMode === "notBotOnly");
        } else {
                generateRepliesQuery(query, user);
        }
	if (user) {
		generateMutedUserQuery(query, user);
		generateMutedNoteQuery(query, user);
		generateBlockedUserQuery(query, user);
		generateMutedUserRenotesQueryForNotes(query, user);
	} else {
		query.andWhere("note.localOnly = false");
	}

	await applyPublicTimelineWarnedUserFilter(query, user, {
		socialFollowingException: false,
	});

	if (user && user.localShowRenote === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
				qb.orWhere("note.userHost IS NOT NULL");
			}),
		);
	}

	if (user && user.remoteShowRenote === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
				qb.orWhere("note.userHost IS NULL");
				qb.orWhere(
					`user.username || '@' || note."userHost" = ANY ('{"${m.recommendedInstances.join(
						'","',
					)}"}')`,
				);
			}),
		);
	}

        if (ps.withFiles) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
        }
	query.andWhere("note.visibility != 'hidden'");
	//#endregion

	process.nextTick(() => {
		if (user) {
			activeUsersChart.read(user);
		}
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
			"notes/global-timeline",
			meta.errors.queryError,
			error,
		);
	}

	if (found.length > ps.limit) {
		found.length = ps.limit;
	}

	return found;
});
