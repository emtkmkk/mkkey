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
		aliases: {
			type: "array",
			items: {
				type: "string",
			},
		},
	},
	required: ["ids", "aliases"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const emojis = await Emojis.findBy({
		id: In(ps.ids),
	});

        await Promise.all(
                emojis.map(async (emoji) => {
                        const aliases = [...new Set(emoji.aliases.concat(ps.aliases))];
                        emoji.aliases = aliases;
                        emoji.updatedAt = new Date();

                        await Emojis.update(emoji.id, {
                                updatedAt: emoji.updatedAt,
                                aliases,
                        });
                }),
        );

        publishBroadcastStream("emojiUpdated", {
                emojis: await Emojis.packMany(emojis),
        });

        await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();
});
