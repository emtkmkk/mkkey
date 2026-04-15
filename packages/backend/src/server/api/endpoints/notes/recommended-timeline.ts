/**
 * @packageDocumentation
 *
 * おすすめタイムラインを取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/recommended-timeline`（GET `/api/notes/recommended-timeline` で呼び出し）
 * - 認証必須。アルゴリズムによるおすすめノートのタイムラインを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Notes, PollVotes } from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { rethrowTimelineQueryAsApiError } from "../../common/rethrow-timeline-query-error.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";

export const meta = {
	tags: ["notes"],
	requireCredentialPrivateMode: true,

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
		rtlDisabled: {
			message: "RTLは無効化されています。",
			code: "RTL_DISABLED",
			id: "45a6eb02-7695-4393-b023-dd3be9aaaefe",
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
		fileType: {
			type: "array",
			items: {
				type: "string",
			},
		},
		excludeNsfw: { type: "boolean", default: false },
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

/**
 * 投票終了間近とみなす時間窓（3時間）
 *
 * @remarks
 * NOTE: おすすめTLへ「終了間近の公開投票」を加算するための固定値。
 *
 * @internal
 */
const POLL_ENDING_SOON_WINDOW_MS = 3 * 60 * 60 * 1000;

export default define(meta, paramDef, async (ps, user) => {
	const m = await fetchMeta();
	if (m.disableRecommendedTimeline) {
		if (user == null || !(user.isAdmin || user.isModerator)) {
			throw new ApiError(meta.errors.rtlDisabled);
		}
	}

	const now = new Date();
	const pollWindowEnd = new Date(now.getTime() + POLL_ENDING_SOON_WINDOW_MS);
	const followingCondition =
		user != null
			? createFollowingExistsCondition(user.id, {
					parameterName: "recommendedTimelineFollowerId",
					alias: "recommendedTimelineFollowing",
			  })
			: null;
	const unvotedPollCondition =
		user != null
			? `NOT EXISTS (${PollVotes.createQueryBuilder("vote")
					.select("1")
					.where("vote.userId = :recommendedTimelineVoteUserId")
					.andWhere('vote."noteId" = note.id')
					.getQuery()})`
			: null;

	//#region クエリ構築
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.leftJoin("note.poll", "poll")
		.andWhere(
			new Brackets((qb) => {
				// NOTE: 既存おすすめ条件（画像付き投稿 or 画像付き純リノート）
				qb.where(
					'(CARDINALITY(note."fileIds") > 0 OR (note.renoteId IS NOT NULL AND note.text IS NULL AND CARDINALITY(renote."fileIds") > 0))',
				);
				// NOTE: 加算条件（フォロー中かつ非botの公開投票で、終了まで3時間以内）
				if (followingCondition && unvotedPollCondition) {
					qb.orWhere(
						new Brackets((pollQb) => {
							pollQb
								.where("note.hasPoll = TRUE")
								.andWhere("user.isBot = FALSE")
								.andWhere(followingCondition.clause("note.userId"))
								.andWhere(unvotedPollCondition)
								.andWhere("poll.expiresAt IS NOT NULL")
								.andWhere("poll.expiresAt > :pollWindowStart")
								.andWhere("poll.expiresAt <= :pollWindowEnd");
						}),
					);
				}
			}),
		)
		.andWhere("(note.visibility = 'public')")
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

	generateChannelQuery(query, user);
	if (followingCondition) {
		query.setParameters(followingCondition.parameters);
	}
	query.setParameters({
		pollWindowStart: now,
		pollWindowEnd,
		recommendedTimelineVoteUserId: user?.id,
	});
	if (user && followingCondition) {
		generateRepliesQuery(
			query,
			user,
			followingCondition,
			ps.showReplyMode ?? "all",
			ps.showReplyMode === "notBotOnly",
		);
	} else {
		generateRepliesQuery(query, user);
	}
	generateVisibilityQuery(query, user);

	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);

	if (user && user.localShowRenote === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
				qb.orWhere("note.userHost IS NOT NULL");
			}),
		);
	}

	if (user && user.remoteShowRenote === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
				qb.orWhere("note.userHost IS NULL");
			}),
		);
	}

	if (ps.withFiles) {
		query.andWhere('CARDINALITY(note."fileIds") > 0');
	}

	if (ps.fileType != null) {
		query.andWhere('CARDINALITY(note."fileIds") > 0');
		query.andWhere(
			new Brackets((qb) => {
				for (const type of ps.fileType!) {
					const i = ps.fileType!.indexOf(type);
					qb.orWhere(`:type${i} = ANY(note.attachedFileTypes)`, {
						[`type${i}`]: type,
					});
				}
			}),
		);

		if (ps.excludeNsfw) {
			query.andWhere("note.cw IS NULL");
			query.andWhere(
				'0 = (SELECT COUNT(*) FROM drive_file df WHERE df.id = ANY(note."fileIds") AND df."isSensitive" = TRUE)',
			);
		}
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
			"notes/recommended-timeline",
			meta.errors.queryError,
			error,
		);
	}

	if (found.length > ps.limit) {
		found.length = ps.limit;
	}

	return found;
});
