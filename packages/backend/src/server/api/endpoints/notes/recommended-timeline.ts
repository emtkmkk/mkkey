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

export default define(meta, paramDef, async (ps, user) => {
	const m = await fetchMeta();
	if (m.disableRecommendedTimeline) {
		if (user == null || !(user.isAdmin || user.isModerator)) {
			throw new ApiError(meta.errors.rtlDisabled);
		}
	}

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

	//#region クエリ共通部
	const applyCommonTimelineFilters = (query: ReturnType<typeof Notes.createQueryBuilder>) => {
		generateChannelQuery(query, user);
		if (followingCondition) {
			query.setParameters(followingCondition.parameters);
		}
		query.setParameters({
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
	};
	//#endregion

	//#region クエリ生成ヘルパー
	const createBaseQuery = () => {
		const query = makePaginationQuery(
			Notes.createQueryBuilder("note"),
			ps.sinceId,
			ps.untilId,
			ps.sinceDate,
			ps.untilDate,
		)
			.andWhere(
				'(CARDINALITY(note."fileIds") > 0 OR (note.renoteId IS NOT NULL AND note.text IS NULL AND CARDINALITY(renote."fileIds") > 0))',
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
		applyCommonTimelineFilters(query);
		return query;
	};

	const createPollQuery = () => {
		if (!(followingCondition && unvotedPollCondition)) return null;
		const query = makePaginationQuery(
			Notes.createQueryBuilder("note"),
			ps.sinceId,
			ps.untilId,
			ps.sinceDate,
			ps.untilDate,
		)
			.leftJoin("note.poll", "poll")
			.andWhere("(note.visibility = 'public')")
			.andWhere("note.hasPoll = TRUE")
			.andWhere("user.isBot = FALSE")
			.andWhere(followingCondition.clause("note.userId"))
			.andWhere(unvotedPollCondition)
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
		applyCommonTimelineFilters(query);
		return query;
	};
	//#endregion

	process.nextTick(() => {
		if (user) {
			activeUsersChart.read(user);
		}
	});

	//#region 取得フロー（従来枠先行 → 範囲内投票 → 不足時のみ範囲外投票）
	const baseTake = Math.floor(ps.limit * 1.5);
	try {
		const baseNotes = await createBaseQuery().take(baseTake).skip(0).getMany();
		const mergedById = new Map(baseNotes.map((note) => [note.id, note]));
		const pollQuery = createPollQuery();

		if (pollQuery && baseNotes.length > 0) {
			const minBaseId = baseNotes.reduce(
				(min, note) => (note.id.localeCompare(min) < 0 ? note.id : min),
				baseNotes[0].id,
			);
			const maxBaseId = baseNotes.reduce(
				(max, note) => (note.id.localeCompare(max) > 0 ? note.id : max),
				baseNotes[0].id,
			);

			// NOTE: 第1段階は従来枠の時間帯（最新〜最古）に含まれる投票のみ追加する。
			const pollInRangeQuery = pollQuery
				.clone()
				.andWhere("note.id <= :pollRangeMaxId", { pollRangeMaxId: maxBaseId })
				.andWhere("note.id >= :pollRangeMinId", { pollRangeMinId: minBaseId });
			const pollInRangeNotes = await pollInRangeQuery
				.take(ps.limit)
				.skip(0)
				.getMany();
			for (const note of pollInRangeNotes) {
				mergedById.set(note.id, note);
			}

			// NOTE: 範囲内投票が不足した場合のみ、範囲外の投票を補完する。
			if (pollInRangeNotes.length < ps.limit) {
				const excludedIds = Array.from(mergedById.keys());
				const pollOutOfRangeQuery = pollQuery.clone().andWhere(
					new Brackets((qb) => {
						qb.where("note.id > :pollRangeMaxId", {
							pollRangeMaxId: maxBaseId,
						}).orWhere("note.id < :pollRangeMinId", {
							pollRangeMinId: minBaseId,
						});
					}),
				);
				if (excludedIds.length > 0) {
					pollOutOfRangeQuery.andWhere("note.id NOT IN (:...excludedIds)", {
						excludedIds,
					});
				}
				const pollOutOfRangeNotes = await pollOutOfRangeQuery
					.take(ps.limit - pollInRangeNotes.length)
					.skip(0)
					.getMany();
				for (const note of pollOutOfRangeNotes) {
					mergedById.set(note.id, note);
				}
			}
		} else if (pollQuery) {
			// NOTE: 従来枠が空でも投票枠が機能するよう、公開投票候補を取得する。
			const pollNotes = await pollQuery.take(ps.limit).skip(0).getMany();
			for (const note of pollNotes) {
				mergedById.set(note.id, note);
			}
		}

		const mergedNotes = Array.from(mergedById.values())
			.sort((a, b) => b.id.localeCompare(a.id))
			.slice(0, ps.limit);
		const { userMap, noteMap } = buildUserAndNoteMapsFromNotes(mergedNotes);
		return await Notes.packMany(mergedNotes, user, {
			_hint_: { userMap, noteMap },
		});
	} catch (error) {
		rethrowTimelineQueryAsApiError(
			"notes/recommended-timeline",
			meta.errors.queryError,
			error,
		);
	}

	return [];
	//#endregion
});
