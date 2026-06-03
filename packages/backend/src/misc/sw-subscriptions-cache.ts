/**
 * @packageDocumentation
 *
 * ユーザーの Web Push 購読一覧を Redis にキャッシュする。
 *
 * @remarks
 * NOTE: register / unregister / 410 削除時に invalidate すること。
 *
 * @internal
 */
import { redisClient } from "@/db/redis.js";
import { SwSubscriptions } from "@/models/index.js";
import type { SwSubscription } from "@/models/entities/sw-subscription.js";
import type { User } from "@/models/entities/user.js";

const CACHE_TTL_SECONDS = 3600;

function cacheKey(userId: User["id"]): string {
	return `swSubscriptions:${userId}`;
}

/**
 * ユーザーの購読一覧を取得する（Redis キャッシュ付き）。
 *
 * @param userId - 対象ユーザー ID
 * @returns 購読行の配列
 * @internal
 */
export async function getSwSubscriptionsByUserId(
	userId: User["id"],
): Promise<SwSubscription[]> {
	const key = cacheKey(userId);
	const cached = await redisClient.get(key);
	if (cached != null) {
		try {
			return JSON.parse(cached) as SwSubscription[];
		} catch {
			await redisClient.del(key);
		}
	}

	const subscriptions = await SwSubscriptions.findBy({ userId });
	await redisClient.set(
		key,
		JSON.stringify(subscriptions),
		"EX",
		CACHE_TTL_SECONDS,
	);
	return subscriptions;
}

/**
 * 購読キャッシュを無効化する。
 *
 * @param userId - 対象ユーザー ID
 * @internal
 */
export async function invalidateSwSubscriptionsCache(
	userId: User["id"],
): Promise<void> {
	await redisClient.del(cacheKey(userId));
}
