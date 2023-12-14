import { Brackets } from "typeorm";
import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";

export const meta = {
	tags: ["users", "notes"],

	requireCredentialPrivateMode: true,
	allowGet: true,
	cacheSec: 3600,
	description: "Show all notes that this user created.",

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
		noSuchUser: {
			message: "No such user.",
			code: "NO_SUCH_USER",
			id: "27e494ba-2ac2-48e8-893b-10d4d8c2387b",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
		borderScore: { type: "string", format: "misskey:id" },
		threshold: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// Lookup user
	const user = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});
	
	const SCORE_TARGET_DAYS = 31;
	const THRESHOLD_SCORE_MULTIPLIER = ps.threshold && Number.isFinite(parseInt(ps.threshold,10)) ? parseInt(ps.threshold,10) : 5;

	let now = new Date();
	let borderDate = new Date();

	borderDate.setDate(now.getDate() - SCORE_TARGET_DAYS);
	borderDate.setMinutes(0);
	borderDate.setSeconds(0);
	borderDate.setMilliseconds(0);
	
	const borderScore = ps.borderScore && Number.isFinite(parseInt(ps.borderScore,10)) ? parseInt(ps.borderScore,10) : ((await Notes.createQueryBuilder("note")
	.select("sum(note.score) * 100 / (count(note.id) + 1) score")
	.where("note.userId = :userId", { userId: user.id })
	.andWhere("note.createdAt >= :borderDate", { borderDate: borderDate.toISOString() })
	.andWhere("note.visibility = 'public'")
	.andWhere(`(note."deletedAt" IS NULL)`)
	.cache(6 * 60 * 60 * 1000)
	.getRawOne()).score * THRESHOLD_SCORE_MULTIPLIER / 100);

	//#region Construct query
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere("note.userId = :userId", { userId: user.id })
		.andWhere("note.score >= :borderScore", { borderScore: Math.floor(borderScore) || 1 })
		.andWhere("note.visibility = 'public'")
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
		.leftJoinAndSelect("renoteUser.banner", "renoteUserBanner")

	generateVisibilityQuery(query, me);
	if (me) {
		generateMutedUserQuery(query, me, user);
		generateBlockedUserQuery(query, me);
	}
	
	//#endregion

	const timeline = await query.take(ps.limit).getMany();

	return await Notes.packMany(timeline, me);
});
