/**
 * メタ絵文字一覧・リモート絵文字取得 API
 *
 * @remarks
 * 返却リストは usageVisibility とモチーフでフィルタする。キャッシュは従来どおり 1 キーで取得し、フィルタはメモリ側で実施。
 * ライセンス・モチーフ等の追加パラメータは falsy ならフィールドごと返さない。リモート絵文字では値があってもそれらのフィールドは返さない。
 * 応答は in-memory で 5 分間キャッシュし、絵文字の DB 読み取りは getStatsDataSource で行う（集計用プールが有効な場合）。
 * リモート絵文字の一覧は全員共通で 1 つだけ作ってキャッシュし（`getRemoteEmojiBase`）、利用者ごとの応答では
 * 同名のローカル絵文字を `Set` で除くだけにしている。以前は利用者ごとに全件を作り直し、名前の照合も配列の
 * `includes` で「ローカル数 × リモート数」回比べていた（最適化監査 A-7 の一部）。
 * OPTIMIZE: ローカル絵文字の pack も利用者ごとに行っている。pack 済みの一覧を共通で持つ余地がある（A-7 の残り）。
 */
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import {
	isEmojiCopyDeniedHost,
	isRemoteEmojiCopyDenied,
} from "@/misc/emoji-copy-policy.js";
import { IsNull, Not } from "typeorm";
import config from "@/config/index.js";
import { getStatsDataSource } from "@/db/postgre.js";
import { Ads, Emojis, Followings, Users, RegistryItems } from "@/models/index.js";
import {
	getEffectiveUsageVisibility,
	NEW_EMOJI_FIELDS,
} from "@/models/repositories/emoji.js";
import { Emoji } from "@/models/entities/emoji.js";
import { Cache } from "@/misc/cache.js";
import { CACHE_MAX_SMALL } from "@/misc/cache-limits.js";
import define from "../define.js";
import type { SchemaType } from "@/misc/schema.js";

/** この API の応答型（res スキーマから導出） */
type EmojisResponse = SchemaType<typeof meta.res>;

/** 応答全体のキャッシュ（TTL 5 分）。キーは me・ps に依存。 */
const EMOJI_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const emojiResponseCache = new Cache<Record<string, unknown>>(
	EMOJI_RESPONSE_CACHE_TTL_MS,
	{ maxEntries: CACHE_MAX_SMALL },
);

/** リモート絵文字用: 追加パラメータを値の有無にかかわらずフィールドごと削除 */
function stripRemoteEmojiFields(obj: Record<string, unknown>): Record<string, unknown> {
	const out = { ...obj };
	for (const key of NEW_EMOJI_FIELDS) {
		delete out[key];
	}
	return out;
}

/** meta_all_emojis 用 MV からリモート絵文字を取得。MV が無い／失敗時は null を返す。 */
type RemoteEmojiRow = { name: string; host: string | null; sensitive: boolean; copyPermission: string | null };

/** リモート絵文字の pack 用に必要な最小プロパティ（MV または Emoji のどちらからも取得可能） */
async function fetchRemoteEmojisFromMv(): Promise<RemoteEmojiRow[] | null> {
	try {
		const ds = getStatsDataSource();
		const rows = await ds.query(
			'SELECT name, host, sensitive, "copyPermission" FROM mv_emoji_remote_snapshot ORDER BY name ASC',
		) as RemoteEmojiRow[];
		return Array.isArray(rows) ? rows : null;
	} catch {
		return null;
	}
}

/** リモート絵文字一覧の範囲。plus はコピー許可のもの、all はコピー拒否以外すべて */
type RemoteEmojiMode = "plus" | "all";

/** 応答に載せるリモート絵文字の最小形 */
type PackedRemoteEmoji = { n: string; h: string | null; s?: true };

/**
 * 全員共通のリモート絵文字一覧（最小形）のキャッシュ。
 *
 * @remarks
 * リモート絵文字の一覧は利用者によって変わらない（変わるのは「同名のローカル絵文字を除く」部分だけ）。
 * 以前は応答キャッシュのキーに利用者 ID が入っていたため、利用者ごとに全件を読み直して作り直し、
 * 同じ中身の大きな配列を利用者の数だけメモリに持っていた。ここで 1 つにまとめ、利用者ごとの応答は
 * この配列の要素を共有する（配列そのものは利用者ごとに作るが、要素は作り直さない）。
 * TTL は応答キャッシュと同じ。
 *
 * @internal
 */
const remoteEmojiBaseCache = new Cache<PackedRemoteEmoji[]>(
	EMOJI_RESPONSE_CACHE_TTL_MS,
	{ maxEntries: 2 },
);

/**
 * 全員共通のリモート絵文字一覧（最小形）を返す
 *
 * @remarks
 * - 禁止ホスト、ホスト名が 50 文字以上のものは除く。
 * - plus: コピー許可（allow）のものだけ。all: コピー拒否（deny）以外、名前が 100 文字未満のもの。
 * - 集計用のマテリアライズドビューが読めればそれを使い、読めなければ emoji テーブルから読む。
 *
 * @param mode - 一覧の範囲
 * @returns 名前順のリモート絵文字（呼び出し側で書き換えないこと）
 * @internal
 */
async function getRemoteEmojiBase(
	mode: RemoteEmojiMode,
): Promise<PackedRemoteEmoji[]> {
	return await remoteEmojiBaseCache.fetch(mode, async () => {
		const rows: RemoteEmojiRow[] =
			(await fetchRemoteEmojisFromMv()) ??
			(await getStatsDataSource()
				.getRepository(Emoji)
				.find({
					select: ["name", "host", "sensitive", "copyPermission"],
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
				}));

		return rows
			.filter((x) => {
				if (isEmojiCopyDeniedHost(x.host)) return false;
				if ((x.host?.length ?? 0) >= 50) return false;
				const permission = fromStoredCopyPermission(x.copyPermission);
				return mode === "plus"
					? permission === "allow"
					: permission !== "deny" && (x.name?.length ?? 0) < 100;
			})
			.map((e) => ({
				n: e.name,
				h: e.host ?? null,
				...(e.sensitive ? { s: true as const } : {}),
			}));
	});
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
							description: "ローカルホストは `null` で表します。",
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

	// NOTE: 応答は分岐ごとに形が異なる（リモート絵文字の圧縮形式などを含む）ため、キャッシュは Record で持ち、
	// 契約である res スキーマの型として返す
	return (await emojiResponseCache.fetch(cacheKey, async () => {
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
							isRemoteEmojiCopyDenied(emoji) ||
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
						// 検索・表示用。空なら返さない
						...(emoji.alternateName ? { alternateName: emoji.alternateName } : {}),
						...(emoji.ruby ? { ruby: emoji.ruby } : {}),
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
				const o = x as unknown as Record<string, unknown>;
				delete o.publicUrl;
				delete o.originalUrl;
			});
		}

		const remoteEmojiMode: RemoteEmojiMode | undefined =
			(ps as { remoteEmojis?: string }).remoteEmojis === "mini" ||
			(ps as { plusEmojis?: boolean }).plusEmojis
				? "plus"
				: (ps as { remoteEmojis?: string }).remoteEmojis === "all" ||
					  (ps as { allEmojis?: boolean }).allEmojis
					? "all"
					: undefined;

		const packedLocal = await Emojis.packMany(emojis);
		/**
		 * リモート絵文字は n(name), h(host), s(sensitive, true のときのみ) の最小形で返す。
		 * 全員共通の一覧（{@link getRemoteEmojiBase}）から、この利用者に見えるローカル絵文字と同名のものだけ除く
		 */
		let packedRemote: PackedRemoteEmoji[] | undefined;
		if (remoteEmojiMode && me) {
			const localNames = new Set(emojis.map((x) => x.name));
			const base = await getRemoteEmojiBase(remoteEmojiMode);
			packedRemote = base.filter((x) => !localNames.has(x.n));
		}

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
	})) as EmojisResponse;
});
