/**
 * 絵文字のモチーフ利用範囲を、モチーフユーザ本人のみが変更する API。
 * 管理者用の admin/emoji/update は requireModerator のため、一般ユーザは利用できない。
 * 本エンドポイントでは motifUserMode のみ更新し、motifUserId は変更しない。
 *
 * @packageDocumentation
 */
import define from "../../define.js";
import { Emojis } from "@/models/index.js";
import { ApiError } from "../../error.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { db } from "@/db/postgre.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";

export const meta = {
	tags: ["emoji"],

	requireCredential: true,

	description:
		"モチーフユーザ本人が、その絵文字の利用可能範囲（motifUserMode）のみを更新する。モチーフユーザの指定は変更できない。",

	errors: {
		noSuchEmoji: {
			message: "その絵文字は存在しません。",
			code: "NO_SUCH_EMOJI",
			id: "684dec9d-a8c2-4364-9aa8-456c49cb1dc8",
		},
		notMotifUser: {
			message: "この絵文字のモチーフユーザではないため変更できません。",
			code: "NOT_MOTIF_USER",
			id: "a1b2c3d4-e5f6-7890-abcd-motifuser001",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Emoji",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		id: { type: "string", format: "misskey:id" },
		motifUserMode: {
			type: "string",
			enum: ["any", "follow", "owner"],
		},
	},
	required: ["id", "motifUserMode"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const emoji = await Emojis.findOneBy({ id: ps.id });
	if (emoji == null) throw new ApiError(meta.errors.noSuchEmoji);

	if (emoji.motifUserId !== me.id) {
		throw new ApiError(meta.errors.notMotifUser);
	}

	await Emojis.update(emoji.id, {
		motifUserMode: ps.motifUserMode,
		updatedAt: new Date(),
	});

	const pack = await Emojis.pack(emoji.id);
	publishBroadcastStream("emojiUpdated", {
		emoji: pack,
		emojis: [pack],
	});
	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();

	return pack;
});
