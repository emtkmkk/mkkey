/**
 * /i エンドポイントで利用する MeDetailed の Redis キャッシュをウォームアップするサービス。
 * ログイン成功直後に呼ぶことで、続くクライアントの /i リクエストでキャッシュヒットしやすくする。
 */

import { redisClient } from "@/db/redis.js";
import { Users } from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";

const ME_DETAILED_VOLATILE_KEYS = [
	"hasUnreadSpecifiedNotes",
	"hasUnreadMentions",
	"hasUnreadAnnouncement",
	"hasUnreadAntenna",
	"hasUnreadChannel",
	"hasUnreadMessagingMessage",
	"hasUnreadNotification",
	"hasPendingReceivedFollowRequest",
] as const;

function createMeDetailedBase(src: Record<string, unknown>): Record<string, unknown> {
	const base = { ...src };
	for (const key of ME_DETAILED_VOLATILE_KEYS) {
		delete base[key];
	}
	return base;
}

/**
 * 指定ユーザーの MeDetailed 用 Redis キャッシュ（base / volatile / merged）を事前に埋める。
 * ログイン成功後に非同期で呼ぶことで、続く /i の初回アクセスでキャッシュヒットさせる。
 *
 * @param user - ログインしたユーザー
 * @param isSecure - token 付きアクセスなら true（API 経由と同じ）
 * @public
 */
export async function warmMeDetailedCache(
	user: ILocalUser,
	isSecure: boolean,
): Promise<void> {
	const userId = user.id;
	const baseCacheKey = Users.getMeDetailedBaseCacheKey(userId, isSecure);
	const volatileCacheKey = Users.getMeDetailedVolatileCacheKey(userId);
	const mergedCacheKey = Users.getMeDetailedMergedCacheKey(userId, isSecure);

	const me = (await Users.pack<true, true>(userId, user, {
		detail: true,
		includeSecrets: isSecure,
	})) as unknown as Record<string, unknown>;
	const base = createMeDetailedBase(me);
	const volatile = await Users.getMeDetailedVolatile(userId);

	await Promise.all([
		redisClient.set(
			baseCacheKey,
			JSON.stringify(base),
			"EX",
			Users.getMeDetailedBaseCacheTtlSec(),
		),
		redisClient.set(
			volatileCacheKey,
			JSON.stringify(volatile),
			"EX",
			Users.getMeDetailedVolatileCacheTtlSec(),
		),
	]);
	const merged = { ...base, ...volatile };
	await redisClient.set(
		mergedCacheKey,
		JSON.stringify(merged),
		"EX",
		Users.getMeDetailedMergedCacheTtlSec(),
	);
}
