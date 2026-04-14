/**
 * @packageDocumentation
 *
 * Mastodon 互換のカスタム絵文字一覧 API。
 *
 * @remarks
 * - **役割**: ローカル絵文字を短 TTL でキャッシュし、並列アクセス時の DB 負荷を抑える。
 *
 * @internal
 */
import { Emojis } from "@/models/index.js";
import type { Emoji } from "@/models/entities/emoji.js";
import { IsNull, In } from "typeorm";
import { FILE_TYPE_BROWSERSAFE } from "@/const.js";
import define from "../../define.js";
import { Cache } from "@/misc/cache.js";

const CUSTOM_EMOJIS_CACHE_TTL_MS = 300_000;

type CustomEmojiRow = {
	shortcode: string;
	url: string;
	static_url: string;
	visible_in_picker: boolean;
	category: string | null;
};

const customEmojisListCache = new Cache<CustomEmojiRow[]>(CUSTOM_EMOJIS_CACHE_TTL_MS);

export const meta = {
	requireCredential: false,
	requireCredentialPrivateMode: true,
	allowGet: true,

	tags: ["meta"],
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	return await customEmojisListCache.fetch(null, async () => {
		const emojis: Emoji[] = await Emojis.find({
			where: { host: IsNull(), type: In(FILE_TYPE_BROWSERSAFE) },
			select: ["name", "originalUrl", "publicUrl", "category"],
		});

		return emojis.map((emoji) => ({
			shortcode: emoji.name,
			url: emoji.originalUrl,
			static_url: emoji.publicUrl,
			visible_in_picker: true,
			category: emoji.category,
		}));
	});
});
