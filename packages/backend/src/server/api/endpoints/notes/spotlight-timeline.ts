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

	let dynamicRTCount1 = 40;
	let dynamicRTCount2 = 40;
	let dynamicRTCount3 = 120;
	let dynamicRTCount4 = 90;
	let dynamicRTCount5 = 8;


	if (user.followingCount < 50) {
		dynamicRTCount1 = 20;
		dynamicRTCount2 = 20;
		dynamicRTCount3 = 60;
		dynamicRTCount4 = 40;
	} else if (user.followingCount < 500) {
		dynamicRTCount1 = 30;
		dynamicRTCount2 = 30;
		dynamicRTCount3 = 90;
		dynamicRTCount4 = 65;
	}

	const followees = await Followings.createQueryBuilder('following')
	.select('following.followeeId')
	.where('following.followerId = :followerId', { followerId: user.id })
	.getMany();

	const meOrFolloweeIds = [user.id, ...followees.map(f => f.followeeId)];
	const meOrFolloweeIdsStr = "'" + meOrFolloweeIds.join("','") + "'"
	
	//#region Construct query
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere(`note.id > '${genId(new Date(Date.now() - (1000 * 60 * 60 * 24 * 10))) ?? genId()}'`)
		.andWhere(new Brackets(qb => {
			qb.where(`((note."userId" IN (${meOrFolloweeIdsStr})) AND (note."score" > ${dynamicRTCount1}) AND (note.renote IS NULL))`)
				.orWhere(`((note."score" > ${dynamicRTCount2}) AND (note."userHost" IS NULL) AND (note.renote IS NULL))`)
				.orWhere(`((note."score" > ${dynamicRTCount3}) AND (note.renote IS NULL))`)
				.orWhere(`((note."userId" IN (${meOrFolloweeIdsStr})) AND (renote."userId" NOT IN (${meOrFolloweeIdsStr})) AND (renote."score" > ${dynamicRTCount4}))`)
				.orWhere(`((note."userId" IN (${meOrFolloweeIdsStr})) AND (note."renoteId" IS NOT NULL) AND (note."userHost" IS NULL) AND (renote."userId" IN (${meOrFolloweeIdsStr})) AND (renote."fileIds" != '{}') AND (renote."userHost" IS NULL) AND (renote."score" > ${dynamicRTCount5}) AND (note."userId" != renote."userId"))`);
		}))
		.andWhere("(note.visibility = 'public')")
		.andWhere(`(note."channelId" IS NULL)`)
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
	generateRepliesQuery(query, user);
	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);
	if (user) generateMutedUserRenotesQueryForNotes(query, user);

	if (user && !user.localShowRenote) {
		query.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
				qb.orWhere("note.fileIds != '{}'");
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
			}),
		);
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