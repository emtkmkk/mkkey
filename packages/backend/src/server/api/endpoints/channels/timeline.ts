import define from "../../define.js";
import { Brackets } from "typeorm";
import { ApiError } from "../../error.js";
import { Notes, Channels, Followings } from "@/models/index.js";
import { safeForSql } from "@/misc/safe-for-sql.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { activeUsersChart } from "@/services/chart/index.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";

export const meta = {
	tags: ["notes", "channels"],

	requireCredential: false,
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
		noSuchChannel: {
			message: "No such channel.",
			code: "NO_SUCH_CHANNEL",
			id: "4d0eeeba-a02c-4c3c-9966-ef60d38d2e7f",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		channelId: { type: "string", format: "misskey:id" },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
	},
	required: ["channelId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const channel = await Channels.findOneBy({
		id: ps.channelId,
	});

	if (channel == null) {
		throw new ApiError(meta.errors.noSuchChannel);
	}

	//#region Construct query
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere("note.visibility = 'public'")
		.andWhere("user.isBot = false")
		.andWhere("(note.renoteId IS NULL OR note.text IS NOT NULL)")
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
		.leftJoinAndSelect("note.channel", "channel");

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

	query.andWhere(
		new Brackets((qb) => {
			qb.orWhere("note.channelId = :channelId", { channelId: channel.id })
			if (!channel.description?.includes("[localOnly]")){
				if (safeForSql(normalizeForSearch(channel.name))){
					qb.orWhere(`'{"${normalizeForSearch(channel.name)}"}' <@ note.tags`);
				}
			}
		}),
	);
	//#endregion

	const timeline = await query.take(ps.limit).getMany();

	if (user) activeUsersChart.read(user);

	return await Notes.packMany(timeline, user);
});
