/**
 * 絵文字リポジトリ（pack 含む）
 *
 * @remarks
 * pack では isTextOnly のとき copyPermission / licenseName / creator を固定値で返す。DB の copyPermission（a/d/c/n）は API 用に完全形に変換して返す。
 */
import config from "@/config/index.js";
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import { db } from "@/db/postgre.js";
import { Emoji } from "@/models/entities/emoji.js";
import type { Packed } from "@/misc/schema.js";

/**
 * エンティティから実効的な usageVisibility を返す。
 * 後方互換: usageVisibility 未設定時は category が ! で始まれば private、それ以外は public。
 *
 * @param emoji - 絵文字エンティティ
 * @returns 'public' | 'limited' | 'user' | 'private'
 * @internal
 */
export function getEffectiveUsageVisibility(emoji: Emoji): string {
	return emoji.usageVisibility != null
		? emoji.usageVisibility
		: emoji.category?.startsWith("!")
			? "private"
			: "public";
}

export const EmojiRepository = db.getRepository(Emoji).extend({
	async pack(src: Emoji["id"] | Emoji): Promise<Packed<"Emoji">> {
		const emoji =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		const effectiveCopyPermission = emoji.isTextOnly
			? "allow"
			: fromStoredCopyPermission(emoji.copyPermission);
		const effectiveLicenseName = emoji.isTextOnly
			? "CC0 1.0 Universal"
			: emoji.licenseName;
		const effectiveCreator = emoji.isTextOnly ? config.host : emoji.creator;

		// 後方互換: usageVisibility 未設定時は category が ! で始まれば private、それ以外は public
		const effectiveUsageVisibility =
			emoji.usageVisibility != null
				? emoji.usageVisibility
				: emoji.category?.startsWith("!")
					? "private"
					: "public";

		return {
			id: emoji.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: emoji.host,
			// || emoji.originalUrl してるのは後方互換性のため
			url: emoji.publicUrl || emoji.originalUrl,
			license: emoji.license,
			copyPermission: effectiveCopyPermission,
			licenseName: effectiveLicenseName,
			usageInfo: emoji.usageInfo,
			creator: effectiveCreator,
			description: emoji.description,
			isBasedOnUrl: emoji.isBasedOnUrl,
			isTextOnly: emoji.isTextOnly,
			sensitive: emoji.sensitive,
			createdAt: emoji.createdAt,
			updatedAt: emoji.updatedAt,
			usageVisibility: effectiveUsageVisibility,
			allowedUserIds: emoji.allowedUserIds ?? [],
			motifUserId: emoji.motifUserId ?? null,
			motifUserMode: emoji.motifUserMode ?? "any",
			...(emoji.oldEmoji ? { oldEmoji: true } : {}),
		};
	},

	packMany(emojis: any[]) {
		return Promise.all(emojis.map((x) => this.pack(x)));
	},
});
