/**
 * 休眠フォロワーのみのリモート投稿スキップ判定
 *
 * リモートユーザーのローカルフォロワーが全員休眠（1ヶ月以上未活動）かどうかを判定し、
 * 受動的配信（inbox）での取り込みスキップ可否に利用する。
 * 休眠の閾値は onlineStatus の super-sleeping と同じ USER_SUPERSLEEP_THRESHOLD（30日）を使用。
 *
 * @packageDocumentation
 * @internal
 */

import { Not, IsNull } from "typeorm";
import { redisClient } from "@/db/redis.js";
import { Followings } from "@/models/index.js";
import { User } from "@/models/entities/user.js";
import { USER_SUPERSLEEP_THRESHOLD } from "@/const.js";

// onlineStatus の super-sleeping 判定と同じ閾値（UserRepository.getOnlineStatus 参照）
const DORMANT_THRESHOLD = USER_SUPERSLEEP_THRESHOLD;

/**
 * 更新前の lastActiveDate が休眠だった場合のみ、そのユーザーがフォローしているリモートのキャッシュを無効化する。
 * lastActiveDate を更新する直前に呼ぶ。ローカルユーザーで、かつ lastActiveDate が null または閾値より前（onlineStatus で super-sleeping 相当）の場合のみ実行する。
 *
 * @param userId - 対象ユーザー ID
 * @param host - ユーザーの host（ローカルなら null）
 * @param lastActiveDateBeforeUpdate - 更新前の lastActiveDate（未取得の場合は null を渡し、呼び出し側で取得してから渡す）
 */
export async function maybeInvalidateDormantFollowerCacheOnActivity(
	userId: string,
	host: string | null,
	lastActiveDateBeforeUpdate: Date | null,
): Promise<void> {
	if (host != null) return;
	const thresholdDate = new Date(Date.now() - DORMANT_THRESHOLD);
	if (
		lastActiveDateBeforeUpdate != null &&
		lastActiveDateBeforeUpdate > thresholdDate
	) {
		return;
	}
	await invalidateDormantFollowerSkipCacheForUser(userId);
}

const CACHE_KEY_PREFIX = "dormant_follower_skip:";
const CACHE_TTL_SEC = 24 * 60 * 60; // 24時間

/**
 * リモート actor について「ローカルフォロワーに 1 人でも 30 日以内に活動した人がいるか」を DB で判定する。
 *
 * @param remoteActorId - リモートユーザー（followee）の ID
 * @returns 1 人でもいれば true、全員休眠またはローカルフォロワー 0 なら false
 * @internal
 */
async function hasActiveLocalFollowerFromDb(
	remoteActorId: string,
): Promise<boolean> {
	const threshold = new Date(Date.now() - DORMANT_THRESHOLD);

	const count = await Followings.createQueryBuilder("f")
		.innerJoin(User, "u", "u.id = f.followerId")
		.where("f.followeeId = :remoteActorId", { remoteActorId })
		.andWhere("f.followerHost IS NULL")
		.andWhere("u.lastActiveDate > :threshold", { threshold })
		.getCount();

	return count > 0;
}

/**
 * 受動的配信で、当該リモートの公開・ホーム向け投稿をスキップしてよいかどうかを返す。
 *
 * ローカルフォロワーが全員休眠（lastActiveDate が 30 日より前または null）なら true（スキップしてよい）。
 * 1 人でも 30 日以内に活動したローカルフォロワーがいれば false（取り込む）。
 * 判定失敗時（Redis/DB エラー）は安全側に倒し false（取り込む）を返す。
 *
 * @param remoteActorId - リモートユーザー（投稿者）の ID
 * @returns スキップしてよい場合 true、取り込む場合 false
 * @remarks
 * キャッシュは Redis の dormant_follower_skip:{actorId} に TTL 24 時間で保存。
 * 値 "1" = スキップ可、"0" = 取り込む。
 */
export async function shouldSkipIngestForDormantFollowersOnly(
	remoteActorId: string,
): Promise<boolean> {
	const cacheKey = CACHE_KEY_PREFIX + remoteActorId;

	try {
		const cached = await redisClient.get(cacheKey);
		if (cached === "1") return true;
		if (cached === "0") return false;
	} catch {
		// Redis 障害時は取り込む（安全側）
		return false;
	}

	try {
		const hasActive = await hasActiveLocalFollowerFromDb(remoteActorId);
		const value = hasActive ? "0" : "1";
		await redisClient.set(cacheKey, value, "EX", CACHE_TTL_SEC);
		return !hasActive;
	} catch {
		// DB エラー時は取り込む（安全側）
		return false;
	}
}

/**
 * 指定したリモートユーザーに関するスキップ判定キャッシュを無効化する。
 *
 * 休眠ユーザーのログイン時や、当該リモートを新規フォローしたときに呼ぶ。
 *
 * @param remoteActorId - リモートユーザー（followee）の ID
 * @internal
 */
export async function invalidateDormantFollowerSkipCache(
	remoteActorId: string,
): Promise<void> {
	const cacheKey = CACHE_KEY_PREFIX + remoteActorId;
	try {
		await redisClient.del(cacheKey);
	} catch {
		// 無効化の失敗は握り潰す（次回 TTL で消える）
	}
}

/**
 * 指定したローカルユーザーがフォローしているリモート全員のスキップ判定キャッシュを無効化する。
 *
 * 休眠ユーザーがログイン（認証成功時）またはストリーム接続したときに呼ぶ。
 *
 * @param localUserId - ローカルユーザー（follower）の ID
 * @internal
 */
export async function invalidateDormantFollowerSkipCacheForUser(
	localUserId: string,
): Promise<void> {
	try {
		const followings = await Followings.find({
			where: {
				followerId: localUserId,
				followeeHost: Not(IsNull()),
			},
			select: { followeeId: true },
		});
		for (const f of followings) {
			await invalidateDormantFollowerSkipCache(f.followeeId);
		}
	} catch {
		// 無効化の失敗は握り潰す
	}
}
