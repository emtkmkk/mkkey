import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";

export const meta = {
	tags: ["notes"],

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
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		offset: { type: "integer", default: 0 },
		origin: {
			type: "string",
			enum: ["combined", "local", "remote"],
			default: "local",
		},
		days: { type: "integer", minimum: 1, maximum: 365, default: 3 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const max = 100;
	const day = 1000 * 60 * 60 * 24 * ps.days;

	const query = Notes.createQueryBuilder("note")
		.andWhere("note.score > 0")
		.andWhere("note.createdAt > :date", { date: new Date(Date.now() - day) })
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
		.leftJoinAndSelect("renoteUser.banner", "renoteUserBanner");

	switch (ps.origin) {
		case "local":
			query.andWhere("note.userHost IS NULL");
			query.andWhere("note.id = ANY (SELECT note2.id FROM note note2 WHERE note.score > 0 AND note2.\"userId\" = note.\"userId\" AND note2.\"createdAt\" >= date_trunc('day',note.\"createdAt\") AND note2.\"createdAt\" < date_trunc('day',note.\"createdAt\") + cast( '1 days' as INTERVAL ) ORDER BY note2.score DESC LIMIT 2)")
			break;
		case "remote":
			query.andWhere("note.userHost IS NOT NULL");
			break;
	}

	if (!user) query.andWhere("note.localOnly = false");
	if (user) generateMutedUserQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);

	let notes = await query.orderBy("note.score", "DESC").take(max).getMany();

	notes.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	notes = notes.slice(ps.offset, ps.offset + ps.limit);

	return await Notes.packMany(notes, user);
});
