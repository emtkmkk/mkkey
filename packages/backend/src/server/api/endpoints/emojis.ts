/**
 * メタ絵文字一覧・リモート絵文字取得 API
 *
 * @remarks
 * 返却リストは usageVisibility とモチーフでフィルタする。キャッシュは従来どおり 1 キーで取得し、フィルタはメモリ側で実施。
 * ライセンス・モチーフ等の追加パラメータは falsy ならフィールドごと返さない。リモート絵文字では値があってもそれらのフィールドは返さない。
 * 応答は in-memory で 5 分間キャッシュし、絵文字の DB 読み取りは getStatsDataSource で行う（集計用プールが有効な場合）。
 */
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import { IsNull, Not } from "typeorm";
import config from "@/config/index.js";
import { getStatsDataSource } from "@/db/postgre.js";
import { Ads, Emojis, Followings, Users, RegistryItems } from "@/models/index.js";
import {
	getEffectiveUsageVisibility,
	NEW_EMOJI_FIELDS,
} from "@/models/repositories/emoji.js";
import type { Emoji } from "@/models/entities/emoji.js";
import { Cache } from "@/misc/cache.js";
import define from "../define.js";

/** 応答全体のキャッシュ（TTL 5 分）。キーは me・ps に依存。 */
const EMOJI_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const emojiResponseCache = new Cache<Record<string, unknown>>(
	EMOJI_RESPONSE_CACHE_TTL_MS,
);

/** リモート絵文字用: 追加パラメータを値の有無にかかわらずフィールドごと削除 */
function stripRemoteEmojiFields(obj: Record<string, unknown>): Record<string, unknown> {
	const out = { ...obj };
	for (const key of NEW_EMOJI_FIELDS) {
		delete out[key];
	}
	return out;
}

/** 一覧に含めるか（usageVisibility とモチーフ）。ローカル絵文字用。 */
function includeEmojiInList(
	emoji: Emoji,
	me: { id: string } | null,
	followeeIds: Set<string>,
): boolean {
	const visibility = getEffectiveUsageVisibility(emoji);
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

async function getEmojiUpdatedAt(emojiRepo: { createQueryBuilder: typeof Emojis.createQueryBuilder }) {
        const latestEmoji = await emojiRepo
		.createQueryBuilder("emoji")
                .select("MAX(COALESCE(emoji.updatedAt, emoji.createdAt))", "updatedAt")
                .where("emoji.oldEmoji = :oldEmoji", { oldEmoji: false })
                .andWhere("emoji.host IS NULL")
                .getRawOne<{ updatedAt: Date | string | null }>();

        return latestEmoji?.updatedAt ? new Date(latestEmoji.updatedAt) : null;
}

export const meta = {
	tags: ["meta"],

	requireCredential: false,
	requireCredentialPrivateMode: true,
	allowGet: true,

	res: {
		type: "object",
		optional: false,
		nullable: false,
                properties: {
                        emojis: {
                                type: "array",
                                optional: false,
                                nullable: false,
                                items: {
                                        type: "object",
					optional: false,
					nullable: false,
					properties: {
						id: {
							type: "string",
							optional: false,
							nullable: false,
							format: "id",
						},
						aliases: {
							type: "array",
							optional: false,
							nullable: false,
							items: {
								type: "string",
								optional: false,
								nullable: false,
							},
						},
						category: {
							type: "string",
							optional: false,
							nullable: true,
						},
						host: {
							type: "string",
							optional: false,
							nullable: true,
							description: "The local host is represented with `null`.",
						},
						url: {
							type: "string",
							optional: false,
							nullable: false,
							format: "url",
						},
                                        },
                                },
                        },
                        emojiUpdatedAt: {
                                type: "string",
                                optional: true,
                                nullable: true,
                                format: "date-time",
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
	const item = me
		? await RegistryItems.createQueryBuilder("item")
				.where("item.domain IS NULL")
				.andWhere("item.userId = :userId", { userId: me.id })
				.andWhere("item.key = 'externalOutputAllEmojis'")
				.andWhere("item.scope = :scope", { scope: ["client", "base"] })
				.getOne()
		: null;
	const allEmojisPath =
		Boolean(me) &&
		Object.keys(ps ?? {}).filter((x) => x !== "i").length === 0 &&
		Boolean((item as { value?: unknown } | null)?.value);
	const cacheKey = allEmojisPath
		? `emojis:all:${me!.id}`
		: `emojis:${me?.id ?? "anon"}:${(ps as { createdAtDesc?: boolean })?.createdAtDesc ?? false}:${(ps as { remoteEmojis?: string })?.remoteEmojis ?? ""}:${(ps as { plusEmojis?: boolean })?.plusEmojis ?? false}:${(ps as { allEmojis?: boolean })?.allEmojis ?? false}`;

	return emojiResponseCache.fetch(cacheKey, async () => {
		const EmojiRepo = getStatsDataSource().getRepository(Emoji);
		const emojiUpdatedAtPromise = getEmojiUpdatedAt(EmojiRepo);

		if (Object.keys(ps ?? {})?.filter((x) => x !== "i").length === 0 && me && (item as { value?: unknown } | null)?.value) {
			let allEmojis = await EmojiRepo.find({
				where: { oldEmoji: false },
				order: { name: "ASC" },
				cache: {
					id: "meta_all_emojis2",
					milliseconds: 3600000,
				},
			});
			const needsFollowCheck = allEmojis.some(
				(x) =>
					x.host == null &&
					x.motifUserId != null &&
					(x.motifUserMode ?? "any") === "follow",
			);
			let followeeIds = new Set<string>();
			if (needsFollowCheck) {
				const followings = await Followings.findBy({ followerId: me.id });
				followeeIds = new Set(followings.map((f) => f.followeeId));
			}
			let emojis = allEmojis
				.map((emoji) => {
					if (emoji.host == null) {
						if (!includeEmojiInList(emoji, me, followeeIds)) return null;
					} else {
						if (
							["voskey.icalo.net", "9ineverse.com", "mogeko.monster"].includes(
								emoji.host,
							) ||
							fromStoredCopyPermission(emoji.copyPermission) === "deny" ||
							emoji.category?.startsWith("!")
						) {
							return null;
						}
					}
					const effectiveCopyPermission = emoji.isTextOnly
						? "allow"
						: fromStoredCopyPermission(emoji.copyPermission);
					const effectiveLicenseName = emoji.isTextOnly
						? "CC0 1.0 Universal"
						: emoji.licenseName;
					const effectiveCreator = emoji.isTextOnly
						? config.host
						: emoji.creator;
					return {
						id: emoji.id,
						aliases: emoji.aliases.filter(Boolean),
						name: emoji.name + (emoji.host ? `@${emoji.host}` : ""),
						category:
							emoji.category ||
							(emoji.host
								? "カテゴリなし(リモート)"
								: "カテゴリなし(ローカル)"),
						host: null,
						// || emoji.originalUrl してるのは後方互換性のため
						url: emoji.host
							? `${config.url}/emoji/${
									emoji.name + (emoji.host ? `@${emoji.host}` : "")
							  }.webp`
							: emoji.publicUrl || emoji.originalUrl,
						license: emoji.license,
						copyPermission: effectiveCopyPermission,
						licenseName: effectiveLicenseName,
						usageInfo: emoji.usageInfo,
						creator: effectiveCreator,
						description: emoji.description,
						isBasedOnUrl: emoji.isBasedOnUrl,
						isTextOnly: emoji.isTextOnly,
						createdAt: emoji.createdAt,
						updatedAt: emoji.updatedAt,
					};
				})
				.filter(Boolean);
			return {
				emojis,
				emojiUpdatedAt: await emojiUpdatedAtPromise,
			};
		}

		let emojis = await EmojiRepo.find({
			where: {
				host: IsNull(),
				oldEmoji: false,
			},
			order: (ps as { createdAtDesc?: boolean }).createdAtDesc
				? {
						createdAt: "DESC",
				  }
				: {
						category: "ASC",
						name: "ASC",
				  },
			cache: {
				id: (ps as { createdAtDesc?: boolean }).createdAtDesc ? "meta_emojis2" : "meta_emojis",
				milliseconds: 3600000, // 1 hour
			},
		});

		let followeeIds = new Set<string>();
		if (me && emojis.length > 0) {
			const needsFollowCheck = emojis.some(
				(x) =>
					x.motifUserId != null && (x.motifUserMode ?? "any") === "follow",
			);
			if (needsFollowCheck) {
				const followings = await Followings.findBy({ followerId: me.id });
				followeeIds = new Set(followings.map((f) => f.followeeId));
			}
		}
		emojis = emojis.filter((x) => includeEmojiInList(x, me, followeeIds));

		if (false && !(ps as { includeUrl?: boolean }).includeUrl) {
			emojis?.forEach((x) => {
				delete (x as Record<string, unknown>).publicUrl;
				delete (x as Record<string, unknown>).originalUrl;
			});
		}

		const emojiNames = emojis.map((x) => x.name);

		let remoteEmojis: Emoji[] | undefined;

		let remoteEmojiMode: string | undefined;

		if ((ps as { remoteEmojis?: string }).remoteEmojis === "mini" || (ps as { plusEmojis?: boolean }).plusEmojis) {
			remoteEmojis = (
				await EmojiRepo.find({
					where: {
						host: Not(IsNull()),
						oldEmoji: false,
					},
					order: {
						name: "ASC",
					},
					cache: {
						id: "meta_all_emojis",
						milliseconds: 3600000, // 1 hour
					},
				})
			).filter(
				(x) =>
					!emojiNames.includes(x.name) &&
					!["voskey.icalo.net", "9ineverse.com", "mogeko.monster"].includes(
						x.host ?? "",
					) &&
					(x.host?.length ?? 0) < 50 &&
					(x.isTextOnly || fromStoredCopyPermission(x.copyPermission) === "allow"),
			);

			remoteEmojiMode = "plus";
		} else if ((ps as { remoteEmojis?: string }).remoteEmojis === "all" || (ps as { allEmojis?: boolean }).allEmojis) {
			remoteEmojis = (
				await EmojiRepo.find({
					where: {
						host: Not(IsNull()),
						oldEmoji: false,
					},
					order: {
						name: "ASC",
					},
					cache: {
						id: "meta_all_emojis",
						milliseconds: 3600000, // 1 hour
					},
				})
			).filter(
				(x) =>
					!emojiNames.includes(x.name) &&
					!["voskey.icalo.net", "9ineverse.com", "mogeko.monster"].includes(
						x.host ?? "",
					) &&
					(x.name?.length ?? 0) < 100 &&
					(x.host?.length ?? 0) < 50 &&
					fromStoredCopyPermission(x.copyPermission) !== "deny",
			);

			remoteEmojiMode = "all";
		}

		const packedLocal = await Emojis.packMany(emojis);
		/** リモート絵文字は n(name), h(host), s(sensitive, true のときのみ) の最小形で返す */
		const packedRemote =
			remoteEmojiMode && remoteEmojis && me
				? remoteEmojis.map((e) => ({
						n: e.name,
						h: e.host ?? null,
						...(e.sensitive ? { s: true as const } : {}),
				  }))
				: undefined;

		return {
			emojiUpdatedAt: await emojiUpdatedAtPromise,
			emojis: packedLocal,
			...(packedRemote
				? {
						emojiFetchDate: new Date(),
						remoteEmojiMode: remoteEmojiMode,
						remoteEmojiCount: packedRemote.length,
						allEmojis: packedRemote,
				  }
				: {}),
		};
	});
});
