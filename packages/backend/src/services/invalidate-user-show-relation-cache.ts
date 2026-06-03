/**
 * @packageDocumentation
 *
 * users/show（UserDetailed）の Redis キャッシュを、フォロー・ブロック等の関係変更後に無効化する。
 *
 * @remarks
 * users/show は閲覧者ごとに relation（isFollowing / isBlocking 等）を含むため、
 * 関係が変わったユーザーのキャッシュをまとめて破棄する。
 *
 * @internal
 */

import type { User } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";

/**
 * 関係変更に関わるユーザーの users/show キャッシュを無効化する。
 *
 * @param userIds フォロー先・フォロワー・ブロック相手など、表示プロフィールのユーザー ID
 * @returns 完了時に resolve する Promise
 * @internal
 */
export async function invalidateUserShowRelationCache(
	...userIds: User["id"][]
): Promise<void> {
	const uniqueIds = [...new Set(userIds.filter((id) => id != null && id !== ""))];
	if (uniqueIds.length === 0) return;

	await Promise.all(
		uniqueIds.map((id) => Users.invalidateUserShowDetailedCache(id)),
	);
}
