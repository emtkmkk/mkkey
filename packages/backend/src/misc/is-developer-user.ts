/**
 * @packageDocumentation
 *
 * ユーザーが dev モード（registry: client/base/developer）かどうかを判定する。
 *
 * @remarks
 * NOTE: クライアントの defaultStore.state.developer と同じレジストリ値を参照する。
 *
 * @internal
 */
import { redisClient } from "@/db/redis.js";
import { RegistryItems } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";

const DEVELOPER_REGISTRY_SCOPE = ["client", "base"] as const;
const DEVELOPER_REGISTRY_KEY = "developer";
const CACHE_TTL_SECONDS = 300;

function getCacheKey(userId: User["id"]): string {
	return `userPrefs:${userId}:developer`;
}

/**
 * ユーザーの developer フラグを取得する（Redis キャッシュ付き）。
 *
 * @param userId - 対象ユーザー ID
 * @returns developer モードが有効なら true
 * @internal
 */
export async function isDeveloperUser(userId: User["id"]): Promise<boolean> {
	const cacheKey = getCacheKey(userId);
	const cached = await redisClient.get(cacheKey);
	if (cached != null) {
		return cached === "1";
	}

	const item = await RegistryItems.createQueryBuilder("item")
		.where("item.domain IS NULL")
		.andWhere("item.userId = :userId", { userId })
		.andWhere("item.key = :key", { key: DEVELOPER_REGISTRY_KEY })
		.andWhere("item.scope = :scope", { scope: [...DEVELOPER_REGISTRY_SCOPE] })
		.getOne();

	const enabled = item?.value === true;
	await redisClient.set(cacheKey, enabled ? "1" : "0", "EX", CACHE_TTL_SECONDS);
	return enabled;
}

/**
 * developer フラグの Redis キャッシュを無効化する。
 *
 * @param userId - 対象ユーザー ID
 * @internal
 */
export async function invalidateDeveloperUserCache(
	userId: User["id"],
): Promise<void> {
	await redisClient.del(getCacheKey(userId));
}
