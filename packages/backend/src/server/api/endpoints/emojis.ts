/**
 * メタ絵文字一覧・リモート絵文字取得 API
 *
 * @remarks
 * 返却リストは usageVisibility とモチーフでフィルタする。キャッシュは従来どおり 1 キーで取得し、フィルタはメモリ側で実施。
 */
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import { IsNull, MoreThan, Not } from "typeorm";
import config from "@/config/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Ads, Emojis, Followings, Users, RegistryItems } from "@/models/index.js";
import { getEffectiveUsageVisibility } from "@/models/repositories/emoji.js";
import type { Emoji } from "@/models/entities/emoji.js";
import define from "../define.js";

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

async function getEmojiUpdatedAt() {
        const latestEmoji = await Emojis.createQueryBuilder("emoji")
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
        const emojiUpdatedAtPromise = getEmojiUpdatedAt();

        if (Object.keys(ps ?? {})?.filter((x) => x !== "i").length === 0 && me) {
                const item = RegistryItems.createQueryBuilder("item")
                        .where("item.domain IS NULL")
			.andWhere("item.userId = :userId", { userId: me.id })
			.andWhere("item.key = 'externalOutputAllEmojis'")
			.andWhere("item.scope = :scope", { scope: ["client", "base"] })
			.getOne();

		if (item?.value) {
			let allEmojis = await Emojis.find({
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
        }

	let emojis = await Emojis.find({
		where: {
			host: IsNull(),
			oldEmoji: false,
		},
		order: ps.createdAtDesc
			? {
					createdAt: "DESC",
			  }
			: {
					category: "ASC",
					name: "ASC",
			  },
		cache: {
			id: ps.createdAtDesc ? "meta_emojis2" : "meta_emojis",
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

	if (false && !ps.includeUrl) {
		emojis?.forEach((x) => {
			delete x.publicUrl;
			delete x.originalUrl;
		});
	}

	const emojiNames = emojis.map((x) => x.name);

	let remoteEmojis = undefined;

	let remoteEmojiMode = undefined;

	if (ps.remoteEmojis === "mini" || ps.plusEmojis) {
		remoteEmojis = (
			await Emojis.find({
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
					x.host,
				) &&
				(x.host?.length ?? 0) < 50 &&
				(x.isTextOnly || fromStoredCopyPermission(x.copyPermission) === "allow"),
		);

		// データ削減の為、不要情報を削除
		remoteEmojis?.forEach((x) => {
			delete x.createdAt;
			delete x.updatedAt;
			delete x.category;
			delete x.aliases;
			delete x.license;
		});
		if (!ps.includeUrl) {
			remoteEmojis?.forEach((x) => {
				delete x.publicUrl;
				delete x.originalUrl;
			});
		}

		remoteEmojiMode = "plus";
	} else if (ps.remoteEmojis === "all" || ps.allEmojis) {
		remoteEmojis = (
			await Emojis.find({
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
					x.host,
				) &&
				(x.name?.length ?? 0) < 100 &&
				(x.host?.length ?? 0) < 50 &&
				fromStoredCopyPermission(x.copyPermission) !== "deny",
		);

		// データ削減の為、不要情報を削除
		remoteEmojis?.forEach((x) => {
			delete x.createdAt;
			delete x.updatedAt;
			delete x.category;
			delete x.aliases;
			delete x.license;
		});
		if (!ps.includeUrl) {
			remoteEmojis?.forEach((x) => {
				delete x.publicUrl;
				delete x.originalUrl;
			});
		}

		remoteEmojiMode = "all";
	}

        return {
                emojiUpdatedAt: await emojiUpdatedAtPromise,
                emojis: await Emojis.packMany(emojis),
                ...(remoteEmojiMode && remoteEmojis && me
			? {
					emojiFetchDate: new Date(),
					remoteEmojiMode: remoteEmojiMode,
					remoteEmojiCount: remoteEmojis?.length ?? 0,
					allEmojis: await Emojis.packMany(remoteEmojis),
			  }
			: {}),
	};
});
