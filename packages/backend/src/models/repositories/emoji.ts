/**
 * @packageDocumentation
 *
 * 絵文字リポジトリ（pack 含む）。
 *
 * @remarks
 * pack では isTextOnly のとき copyPermission / licenseName / creator を固定値で返す。DB の copyPermission（a/d/c/n）は API 用に完全形に変換して返す。
 * 返却前に新規項目の falsy 削除とデフォルト値キー削除を適用する（キーが無い場合はクライアントでデフォルト扱い）。
 */
import config from "@/config/index.js";
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import { db } from "@/db/postgre.js";
import { Emoji } from "@/models/entities/emoji.js";
import type { Packed } from "@/misc/schema.js";

/** ライセンス・モチーフなど追加パラメータ。falsy ならキーを返さない（emojis.ts の stripRemoteEmojiFields からも利用） */
export const NEW_EMOJI_FIELDS = [
	"license",
	"licenseName",
	"usageInfo",
	"creator",
	"description",
	"isBasedOnUrl",
	"usageVisibility",
	"allowedUserIds",
	"motifUserId",
	"motifUserMode",
	"category",
	"host",
] as const;

/** デフォルト値のときはキーを返さない */
const DEFAULT_EMOJI_FIELD_VALUES: Record<string, unknown> = {
	isTextOnly: false,
	sensitive: false,
	usageVisibility: "public",
	motifUserMode: "any",
	category: null,
	copyPermission: "none",
};

function stripFalsyNewEmojiFields(obj: Record<string, unknown>): Record<string, unknown> {
	const out = { ...obj };
	for (const key of NEW_EMOJI_FIELDS) {
		if (!(key in out)) continue;
		const v = out[key];
		const isEmptyString =
			typeof v === "string" && v.trim().length === 0;
		if (v == null || isEmptyString || (Array.isArray(v) && v.length === 0)) {
			delete out[key];
		}
	}
	return out;
}

function stripDefaultEmojiFields(obj: Record<string, unknown>): Record<string, unknown> {
	const out = { ...obj };
	for (const [key, defaultValue] of Object.entries(DEFAULT_EMOJI_FIELD_VALUES)) {
		if (key in out && out[key] === defaultValue) {
			delete out[key];
		}
	}
	return out;
}

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

/**
 * 指定ユーザがその絵文字を使用できるか（usageVisibility とモチーフで判定）。
 * リアクション・ノート投稿時の権限チェックに利用する。
 *
 * @param emoji - 絵文字エンティティ（usageVisibility, allowedUserIds, motifUserId, motifUserMode を含むこと）
 * @param me - 利用者（未認証の場合は null）
 * @param followeeIds - 利用者がフォローしているユーザ ID の集合（モチーフ follow 判定用）
 * @returns 使用可能なら true
 * @internal
 */
export function canUseEmoji(
	emoji: Pick<
		Emoji,
		"usageVisibility" | "allowedUserIds" | "motifUserId" | "motifUserMode" | "category"
	>,
	me: { id: string } | null,
	followeeIds: Set<string>,
): boolean {
	const visibility = getEffectiveUsageVisibility(emoji as Emoji);
	if (visibility === "private") return false;
	if (!me) {
		if (visibility !== "public" && visibility !== "limited") return false;
	} else {
		if (visibility === "user") {
			const allowed = emoji.allowedUserIds ?? [];
			if (!allowed.includes(me.id)) return false;
		}
	}
	const mode = emoji.motifUserMode ?? "any";
	if (emoji.motifUserId == null || mode === "any") return true;
	if (!me) return false;
	if (mode === "follow") return followeeIds.has(emoji.motifUserId);
	if (mode === "owner") return emoji.motifUserId === me.id;
	return true;
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

		const raw: Record<string, unknown> = {
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
		return stripDefaultEmojiFields(
			stripFalsyNewEmojiFields(raw),
		) as Packed<"Emoji">;
	},

	packMany(emojis: any[]) {
		return Promise.all(emojis.map((x) => this.pack(x)));
	},
});
