import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { In } from "typeorm";
import { ApiError } from "../../../error.js";
import { db } from "@/db/postgre.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		ids: {
			type: "array",
			items: {
				type: "string",
				format: "misskey:id",
			},
		},
		category: {
			type: "string",
			nullable: true,
			description: "カテゴリをクリアする場合は `null` を指定します。",
		},
	},
	required: ["ids"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const emojis = await Emojis.findBy({
		id: In(ps.ids),
	});

	await Emojis.update(
		{
			id: In(ps.ids),
		},
		{
			updatedAt: new Date(),
			category: ps.category,
		},
	);

	publishBroadcastStream("emojiUpdated", {
		emojis: await Emojis.packMany(emojis),
	});

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();
});
