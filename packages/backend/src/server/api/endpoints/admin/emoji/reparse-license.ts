/**
 * 絵文字の license 文字列をパースし直して個別カラム・補足情報を更新する API
 *
 * 移行後にフォーマットが分かったデータの再取り込みや、手動で再パースする用途で利用する。
 *
 * @packageDocumentation
 */
import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { ApiError } from "../../../error.js";
import { parseLicenseString } from "@/misc/parse-license.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { db } from "@/db/postgre.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:emoji",

	errors: {
		noSuchEmoji: {
			message: "その絵文字は存在しません。",
			code: "NO_SUCH_EMOJI",
			id: "e1f2a3b4-c5d6-7890-efab-cdef12345678",
		},
		parseFailed: {
			message: "license 文字列をパースできませんでした。想定外のフォーマットの可能性があります。",
			code: "PARSE_FAILED",
			id: "f2a3b4c5-d6e7-8901-fabc-def123456789",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		id: { type: "string", format: "misskey:id" },
	},
	required: ["id"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const emoji = await Emojis.findOneBy({ id: ps.id });
	if (emoji == null) {
		throw new ApiError(meta.errors.noSuchEmoji);
	}

	const parsed = parseLicenseString(emoji.license);
	if (parsed == null) {
		throw new ApiError(meta.errors.parseFailed);
	}

	await Emojis.update(emoji.id, {
		updatedAt: new Date(),
		copyPermission: parsed.copyPermission,
		licenseName: parsed.licenseName,
		usageInfo: parsed.usageInfo,
		creator: parsed.creator,
		description: parsed.description,
		isBasedOnUrl: parsed.isBasedOnUrl,
		license: parsed.remainder,
		isTextOnly: parsed.isTextOnly,
	});

	const updated = await Emojis.findOneByOrFail({ id: ps.id });
	const pack = await Emojis.pack(updated.id);

	publishBroadcastStream("emojiUpdated", {
		emoji: pack,
		emojis: [pack],
	});

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();

	return { id: emoji.id };
});
