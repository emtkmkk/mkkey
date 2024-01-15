import { Brackets } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Notes, Users, Followings } from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { genId } from "@/misc/gen-id.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";

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
			message: "Local timeline has been disabled.",
			code: "LTL_DISABLED",
			id: "45a6eb02-7695-4393-b023-dd3be9aaaefd",
		},
		queryError: {
			message: "Please follow more users.",
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
			description: "Only show notes that have attached files.",
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
	const m = await fetchMeta();
	if (m.disableLocalTimeline) {
		if (user == null || !(user.isAdmin || user.isModerator)) {
			throw new ApiError(meta.errors.ltlDisabled);
		}
	}


	const followees = await Followings.createQueryBuilder('following')
		.select('following.followeeId')
		.where('following.followerId = :followerId', { followerId: user.id })
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

	const meOrFolloweeIds = [user.id, ...followees.map(f => f.followeeId)];

	//#region Construct query
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere(`note.id > '${genId(new Date(Date.now() - (1000 * 60 * 60 * 24 * 7))) ?? genId()}'`)
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

	generateChannelQuery(query, user);
	if (user) {
		const followingQuery = Followings.createQueryBuilder("following")
			.select("following.followeeId")
			.where("following.followerId = :followerId", { followerId: user.id });
		query.setParameters(followingQuery.getParameters());
		generateRepliesQuery(query, user, followingQuery.getQuery());
	} else {
		generateRepliesQuery(query, user);
	}
	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);
	if (user) generateMutedUserRenotesQueryForNotes(query, user);

	if (followees.length > 0) {
		const meOrFolloweeIds = [user.id, ...followees.map(f => f.followeeId)];

		const followingNetworksQuery = await Notes.createQueryBuilder('note')
			.select('note.renoteUserId')
			.distinct(true)
			.andWhere('note.id > :minId', { minId: genId(new Date(Date.now() - (1000 * 60 * 60 * 24 * 2))) })
			.andWhere('note.renoteId IS NOT NULL')
			.andWhere('note.text IS NULL')
			.andWhere('note.userId IN (:...meOrFolloweeIds)', { meOrFolloweeIds: meOrFolloweeIds })
			.andWhere(`(note.score > :localScore)`, { localScore: localScore })
			.andWhere(new Brackets(qb => {
				qb.where(`(note.userHost = note.renoteUserHost)`)
					.orWhere(`(note.userHost IS NULL)`);
			}));


		generateMutedUserRenotesQueryForNotes(followingNetworksQuery, user);
		const followingNetworks = await followingNetworksQuery.getMany();

		const meOrfollowingNetworks = [user.id, ...followingNetworks.map(f => f.renoteUserId), ...followees.map(f => f.followeeId)];

		query.andWhere('note.userId IN (:...meOrfollowingNetworks)', { meOrfollowingNetworks: meOrfollowingNetworks })
			.andWhere(new Brackets(qb => {
				qb.where(`(note.score > :globalScore) AND (user.isExplorable = TRUE)`, { globalScore: globalScore })
					.orWhere(`(note.userHost IS NULL) AND (note.score > :localScore) AND (user.isExplorable = TRUE)`, { localScore: localScore })
					.orWhere(`(note.score > :followeeScore) AND (note.userId IN (:...meOrFolloweeIds))`, { meOrFolloweeIds: meOrFolloweeIds, followeeScore: followeeScore });
			}));
	} else {
		query.andWhere(`(note.userHost IS NULL) AND (note.score > 90) AND (user.isExplorable = TRUE)`);
	}

	if (ps.withFiles) {
		query.andWhere("note.fileIds != '{}'");
	}

	if (ps.fileType != null) {
		query.andWhere("note.fileIds != '{}'");
		query.andWhere(
			new Brackets((qb) => {
				for (const type of ps.fileType!) {
					const i = ps.fileType!.indexOf(type);
					qb.orWhere(`'{":type${i}"}' <@ (note.attachedFileTypes)`, {
						[`type${i}`]: type,
					});
				}
			}),
		);

		if (ps.excludeNsfw) {
			query.andWhere("note.cw IS NULL");
			query.andWhere(
				'0 = (SELECT COUNT(*) FROM drive_file df WHERE \'{"df.id"}\' <@ (note."fileIds") AND df."isSensitive" = TRUE)',
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

	// We fetch more than requested because some may be filtered out, and if there's less than
	// requested, the pagination stops.
	const found = [];
	const foundAppearNoteId = [];
	const take = Math.floor(ps.limit * 1.5);
	let skip = 0;
	//try {
	while (found.length < ps.limit) {
		let notes = await query.take(take).skip(skip).getMany();
		// 同じappearNoteの場合は除外
		notes = notes.map(x => {
			if (foundAppearNoteId.includes(x.renoteId || x.id)) return undefined;
			foundAppearNoteId.push(x.renoteId || x.id);
			return x;
		}).filter(x => x !== undefined);
		found.push(...(await Notes.packMany(notes, user)));
		skip += take;
		if (notes.length < take) break;
	}
	//} catch (error) {
	//throw new ApiError(meta.errors.queryError);
	//}

	if (found.length > ps.limit) {
		found.length = ps.limit;
	}

	return found;
});
