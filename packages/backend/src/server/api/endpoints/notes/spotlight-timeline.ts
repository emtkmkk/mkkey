/**
 * @packageDocumentation
 *
 * スポットライト（ピン留め・おすすめ）タイムラインを取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/spotlight-timeline`（GET `/api/notes/spotlight-timeline` で呼び出し）
 * - 認証不要。インスタンスのスポットライトに表示するノートを取得する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Notes, Followings, PollVotes } from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { genId } from "@/misc/gen-id.js";
import { rethrowTimelineQueryAsApiError } from "../../common/rethrow-timeline-query-error.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";
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
		ltlDisabled: {
			message: "LTLは無効化されています。",
			code: "LTL_DISABLED",
			id: "45a6eb02-7695-4393-b023-dd3be9aaaefd",
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
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	/*
		const m = await fetchMeta();
		if (m.disableLocalTimeline) {
			if (user == null || !(user.isAdmin || user.isModerator)) {
				throw new ApiError(meta.errors.ltlDisabled);
			}
		}
	*/

	const followees = await Followings.createQueryBuilder("following")
		.select("following.followeeId")
		.where("following.followerId = :followerId", { followerId: user.id })
		.getMany();

	// もこきーのスコア計算
	// ローカルユーザー RT : 9 Reaction : 3
	// リモートユーザー RT : 3 Reaction : 1

	let followeeScore = 20;
	let localScore = 40;
	let globalScore = 60;

	if (followees.length >= 50) {
		followeeScore = 28;
		localScore = 48;
		globalScore = 60;
	} else if (followees.length >= 150) {
		followeeScore = 40;
		localScore = 60;
		globalScore = 90;
	} else if (followees.length >= 300) {
		followeeScore = 60;
		localScore = 80;
		globalScore = 135;
	} else if (followees.length >= 500) {
		followeeScore = 80;
		localScore = 120;
		globalScore = 180;
	}

	const meOrFolloweeIds = [user.id, ...followees.map((f) => f.followeeId)];

	ps.untilDate = ps.untilDate || Date.now();
	ps.sinceDate = ps.untilDate - 1000 * 60 * 60 * 24 * 7;
	const scoreWindowMinId = genId(new Date(ps.sinceDate));
	const scoreWindowMaxId = genId(new Date(ps.untilDate));
	const followingCondition = createFollowingExistsCondition(user.id, {
		parameterName: "spotlightTimelineFollowerId",
		alias: "spotlightTimelineFollowing",
	});
	const unvotedPollCondition = `NOT EXISTS (${PollVotes.createQueryBuilder("vote")
		.select("1")
		.where("vote.userId = :spotlightTimelineVoteUserId")
		.andWhere('vote."noteId" = note.id')
		.getQuery()})`;

	//#region クエリヘルパー
	const applyCommonTimelineFilters = (
		query: ReturnType<typeof Notes.createQueryBuilder>,
	): void => {
		generateChannelQuery(query, user);
		query.setParameters(followingCondition.parameters);
		query.setParameters({
			spotlightTimelineVoteUserId: user.id,
		});
		generateRepliesQuery(query, user, followingCondition);
		generateVisibilityQuery(query, user);
		generateMutedUserQuery(query, user);
		generateMutedNoteQuery(query, user);
		generateBlockedUserQuery(query, user);
		generateMutedUserRenotesQueryForNotes(query, user);

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

	const createBaseQuery = async () => {
		const query = makePaginationQuery(
			Notes.createQueryBuilder("note"),
			ps.sinceId,
			ps.untilId,
			ps.sinceDate,
			ps.untilDate,
		)
			.andWhere("(note.visibility = 'public')")
			.andWhere(`(note."channelId" IS NULL)`)
			.andWhere(`(note."deletedAt" IS NULL)`)
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

		if (followees.length > 0) {
			const followingNetworksQuery = await Notes.createQueryBuilder("note")
				.select("note.renoteUserId")
				.distinct(true)
				.andWhere("note.id > :minId", { minId: scoreWindowMinId })
				.andWhere("note.id < :maxId", { maxId: scoreWindowMaxId })
				.andWhere("note.renoteId IS NOT NULL")
				.andWhere("note.text IS NULL")
				.andWhere("note.userId IN (:...meOrFolloweeIds)", {
					meOrFolloweeIds,
				})
				.andWhere("(note.score > :localScore)", { localScore })
				.andWhere(
					new Brackets((qb) => {
						qb.where("(note.userHost = note.renoteUserHost)").orWhere(
							"(note.userHost IS NULL)",
						);
					}),
				);

			generateMutedUserRenotesQueryForNotes(followingNetworksQuery, user);
			const followingNetworks = await followingNetworksQuery.getMany();

			const meOrfollowingNetworks = [
				user.id,
				...followingNetworks.map((f) => f.renoteUserId),
				...followees.map((f) => f.followeeId),
			];

			query
				.andWhere("note.userId IN (:...meOrfollowingNetworks)", {
					meOrfollowingNetworks,
				})
				.andWhere(
					new Brackets((qb) => {
						qb.where(
							"(note.score > :globalScore) AND (user.isExplorable = TRUE)",
							{ globalScore },
						)
							.orWhere(
								"(note.userHost IS NULL) AND (note.score > :localScore) AND (user.isExplorable = TRUE)",
								{ localScore },
							)
							.orWhere(
								"(note.score > :followeeScore) AND (note.userId IN (:...meOrFolloweeIds))",
								{
									meOrFolloweeIds,
									followeeScore,
								},
							);
					}),
				);
		} else {
			query.andWhere(
				"(note.userHost IS NULL) AND (note.score > 90) AND (user.isExplorable = TRUE)",
			);
		}
		return query;
	};

	const createPollQuery = () => {
		const query = makePaginationQuery(
			Notes.createQueryBuilder("note"),
			ps.sinceId,
			ps.untilId,
			ps.sinceDate,
			ps.untilDate,
		)
			.leftJoin("note.poll", "poll")
			.andWhere("(note.visibility = 'public')")
			.andWhere(`(note."channelId" IS NULL)`)
			.andWhere(`(note."deletedAt" IS NULL)`)
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

	// NOTE: 従来枠を先に取得し、範囲内投票を優先追加。不足時のみ範囲外投票を補完する。
	const baseTake = Math.floor(ps.limit * 1.5);
	try {
		const baseQuery = await createBaseQuery();
		const fetchedBaseNotes = await baseQuery.take(baseTake).skip(0).getMany();
		const appearNoteIds = new Set<string>();
		const baseNotes = fetchedBaseNotes.filter((note) => {
			const appearId = note.renoteId ?? note.id;
			if (appearNoteIds.has(appearId)) return false;
			appearNoteIds.add(appearId);
			return true;
		});
		const mergedById = new Map(baseNotes.map((note) => [note.id, note]));

		if (baseNotes.length > 0) {
			const minBaseId = baseNotes.reduce(
				(min, note) => (note.id.localeCompare(min) < 0 ? note.id : min),
				baseNotes[0].id,
			);
			const maxBaseId = baseNotes.reduce(
				(max, note) => (note.id.localeCompare(max) > 0 ? note.id : max),
				baseNotes[0].id,
			);
			const pollQuery = createPollQuery();

			const pollInRangeNotes = await pollQuery
				.clone()
				.andWhere("note.id <= :pollRangeMaxId", { pollRangeMaxId: maxBaseId })
				.andWhere("note.id >= :pollRangeMinId", { pollRangeMinId: minBaseId })
				.take(ps.limit)
				.skip(0)
				.getMany();
			for (const note of pollInRangeNotes) {
				mergedById.set(note.id, note);
			}

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
			"notes/spotlight-timeline",
			meta.errors.queryError,
			error,
		);
	}
});
