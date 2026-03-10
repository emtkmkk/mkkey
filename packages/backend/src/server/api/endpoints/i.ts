import { redisClient } from "@/db/redis.js";
import { Users } from "@/models/index.js";
import type { MeDetailedVolatile } from "@/models/repositories/user.js";
import define from "../define.js";

const meDetailedVolatileKeys = [
	"hasUnreadSpecifiedNotes",
	"hasUnreadMentions",
	"hasUnreadAnnouncement",
	"hasUnreadAntenna",
	"hasUnreadChannel",
	"hasUnreadMessagingMessage",
	"hasUnreadNotification",
	"hasPendingReceivedFollowRequest",
] as const;

export const meta = {
	tags: ["account"],

	requireCredential: true,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "MeDetailed",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

function extractMeDetailedVolatile(src: Record<string, unknown>): MeDetailedVolatile {
	return {
		hasUnreadSpecifiedNotes: Boolean(src.hasUnreadSpecifiedNotes),
		hasUnreadMentions: Boolean(src.hasUnreadMentions),
		hasUnreadAnnouncement: Boolean(src.hasUnreadAnnouncement),
		hasUnreadAntenna: Boolean(src.hasUnreadAntenna),
		hasUnreadChannel: Boolean(src.hasUnreadChannel),
		hasUnreadMessagingMessage: Boolean(src.hasUnreadMessagingMessage),
		hasUnreadNotification: Boolean(src.hasUnreadNotification),
		hasPendingReceivedFollowRequest: Boolean(src.hasPendingReceivedFollowRequest),
	};
}

function createMeDetailedBase(src: Record<string, unknown>): Record<string, unknown> {
	const base = { ...src };

	for (const key of meDetailedVolatileKeys) {
		delete base[key];
	}

	return base;
}

export default define(meta, paramDef, async (ps, user, token) => {
	const isSecure = token == null;
	const userId = user.id;

	const mergedCacheKey = Users.getMeDetailedMergedCacheKey(userId, isSecure);
	const mergedCache = await redisClient.get(mergedCacheKey);

	if (mergedCache != null) {
		return JSON.parse(mergedCache) as Record<string, unknown>;
	}

	const baseCacheKey = Users.getMeDetailedBaseCacheKey(userId, isSecure);
	const volatileCacheKey = Users.getMeDetailedVolatileCacheKey(userId);

	let base: Record<string, unknown> | null = null;
	const baseCache = await redisClient.get(baseCacheKey);

	if (baseCache != null) {
		base = JSON.parse(baseCache) as Record<string, unknown>;
	}

	if (base == null) {
		// まとめ読み: Me を avatar/banner 付きで 1 回取得し hint で渡して drive_file の個別参照を避ける
		const meWithRelations = await Users.findOne({
			where: { id: userId },
			relations: { avatar: true, banner: true },
		});
		const me = (await Users.pack<true, true>(userId, user, {
			detail: true,
			includeSecrets: isSecure,
		}, meWithRelations != null ? { user: meWithRelations } : undefined)) as unknown as Record<string, unknown>;
		base = createMeDetailedBase(me);

		await redisClient.set(
			baseCacheKey,
			JSON.stringify(base),
			"EX",
			Users.getMeDetailedBaseCacheTtlSec(),
		);
	}

	let volatile: MeDetailedVolatile | null = null;
	const volatileCache = await redisClient.get(volatileCacheKey);

	if (volatileCache != null) {
		volatile = extractMeDetailedVolatile(
			JSON.parse(volatileCache) as Record<string, unknown>,
		);
	}

	if (volatile == null) {
		volatile = await Users.getMeDetailedVolatile(userId);
		await redisClient.set(
			volatileCacheKey,
			JSON.stringify(volatile),
			"EX",
			Users.getMeDetailedVolatileCacheTtlSec(),
		);
	}

	const merged = {
		...base,
		...volatile,
	};

	await redisClient.set(
		mergedCacheKey,
		JSON.stringify(merged),
		"EX",
		Users.getMeDetailedMergedCacheTtlSec(),
	);

	return merged;
});
