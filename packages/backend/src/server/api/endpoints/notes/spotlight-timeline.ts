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

	let dynamicRTCount1 = 10;
	let dynamicRTCount2 = 40;
	let dynamicRTCount3 = 60;
	let dynamicRTCount4 = 15;
	let dynamicRTCount5 = 2;


	if (user.followingCount < 50) {
		dynamicRTCount1 = 5;
		dynamicRTCount2 = 10;
		dynamicRTCount3 = 20;
		dynamicRTCount4 = 7;
	} else if (user.followingCount < 500) {
		dynamicRTCount2 = 20;
		dynamicRTCount3 = 30;
		dynamicRTCount4 = 10;
	}

	const followingQuery = Followings.createQueryBuilder("following")
		.select("following.followeeId")
		.where("following.followerId = :followerId", { followerId: user.id });

	//#region Construct query
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere('note.id > :minId', { minId: genId(new Date(Date.now() - (1000 * 60 * 60 * 24 * 10))) })
		.andWhere(new Brackets(qb => {
			qb.where(`((note."userId" IN (${followingQuery.getQuery()})) AND (note."renoteCount" > ${dynamicRTCount1 ?? 5}) AND (note.renote IS NULL))`)
				.orWhere(`((note."renoteCount" > ${dynamicRTCount2 ?? 10}) AND (note."userHost" IS NULL) AND (note.renote IS NULL))`)
				.orWhere(`((note."renoteCount" > ${dynamicRTCount3 ?? 20}) AND (note.renote IS NULL))`)
				.orWhere(`((note."userId" IN (${followingQuery.getQuery()})) AND (renote."userId" NOT IN (${followingQuery.getQuery()})) AND (renote."renoteCount" > ${dynamicRTCount4 ?? 7})) AND (note.id IN (SELECT max_id from (SELECT MAX(note.id) max_id FROM note WHERE (note."userId" IN (${followingQuery.getQuery()})) GROUP BY note."renoteId") temp))`)
				.orWhere(`((note."userId" IN (${followingQuery.getQuery()})) AND (note."renoteId" IS NOT NULL) AND (note."userHost" IS NULL) AND (renote."userId" IN (${followingQuery.getQuery()})) AND (renote."fileIds" != '{}') AND (renote."userHost" IS NULL) AND (renote."renoteCount" > ${dynamicRTCount5 ?? 2})) AND (note."userId" != renote."userId") AND (note.id IN (SELECT max_id from (SELECT MAX(note.id) max_id FROM note WHERE ((note."userId" IN (${followingQuery.getQuery()})) AND (note."userHost" IS NULL) AND (note."userId" != renote."userId")) GROUP BY note."renoteId") temp))`);
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
	const take = Math.floor(ps.limit * 1.5);
	let skip = 0;
	//try {
		while (found.length < ps.limit) {
			const notes = await query.take(take).skip(skip).getMany();
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