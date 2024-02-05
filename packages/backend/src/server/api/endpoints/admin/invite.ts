import rndstr from "rndstr";
import { ApiError } from "../../error.js";
import define from "../../define.js";
import { RegistrationTickets } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: false,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			code: {
				type: "string",
				optional: false,
				nullable: false,
				example: "2ERUA5VR",
				maxLength: 8,
				minLength: 8,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// 招待可能条件
	// 登録から(7日-((投稿数-20)*1.5時間))経過
	// ただし1日未満にはならない
	// 投稿数が20以上

	// 36投稿 : 6日  52投稿 : 5日  68投稿 : 4日
	// 84投稿 : 3日 100投稿 : 2日 116投稿 : 1日

	const eTime = Date.now() - new Date(me.createdAt).valueOf();
	const inviteBorder =
		eTime > 7 * 24 * 60 * 60 * 1000
			? 7 * 24 * 60 * 60 * 1000
			: Math.max(
					7 * 24 * 60 * 60 * 1000 - me.notesCount * 90 * 60 * 1000,
					24 * 60 * 60 * 1000,
			  );
	const canInvite = eTime > inviteBorder && me.notesCount >= 20;

	if (me.isSilenced || !canInvite) {
		throw new ApiError();
	}

	const code = rndstr({
		length: 8,
		chars: "2-9A-HJ-NP-Z", // [0-9A-Z] w/o [01IO] (32 patterns)
	});

	await RegistrationTickets.insert({
		id: genId(),
		createdAt: new Date(),
		code,
		inviteUserId: me.id,
	});

	return {
		code,
	};
});
