/**
 * @packageDocumentation
 *
 * 絵文字ピッカーのモチーフ判定に使うフォロー一覧キャッシュ。
 *
 * @remarks
 * NOTE: モチーフユーザ判定が必要なときだけ `users/following` を取得する。
 * NOTE: 1 セッション中は Promise を共有して重複リクエストを防ぐ。
 * NOTE: API 側が `limit` を受け取るため、100 件超のフォローは未取得になる制約がある。
 *
 * @internal
 */

import * as os from "@/os";

type EmojiForMotifCheck = {
	motifUserId?: string | null;
	motifUserMode?: string | null;
};

let cachedUserId: string | null = null;
let cachedFolloweeIds: Set<string> | null = null;
let loadingFolloweeIds: Promise<Set<string>> | null = null;

/**
 * モチーフ any 判定が必要な絵文字が含まれるかを返す。
 *
 * @param emojis - 判定対象の絵文字配列
 * @returns モチーフ any 判定が必要なら true
 * @internal
 */
export function needsMotifAnyFollowCheck(
	emojis: readonly EmojiForMotifCheck[] | null | undefined,
): boolean {
	if (!emojis?.length) return false;
	return emojis.some(
		(emoji) =>
			emoji.motifUserId != null &&
			(emoji.motifUserMode ?? "any") === "any",
	);
}

/**
 * モチーフ判定用の followeeIds を返す（セッションキャッシュあり）。
 *
 * @param userId - ログインユーザ ID
 * @returns フォロー中ユーザ ID の集合
 * @internal
 */
export async function getFolloweeIdsForMotifCheck(
	userId: string,
): Promise<Set<string>> {
	if (cachedUserId === userId && cachedFolloweeIds) {
		return cachedFolloweeIds;
	}
	if (cachedUserId === userId && loadingFolloweeIds) {
		return loadingFolloweeIds;
	}

	cachedUserId = userId;
	loadingFolloweeIds = os
		.api("users/following", { userId, limit: 100 })
		.then((list: { followeeId?: string; id?: string }[]) => {
			const ids = new Set(
				list.map((x) => x.followeeId ?? x.id).filter(Boolean) as string[],
			);
			cachedFolloweeIds = ids;
			return ids;
		})
		.catch(() => {
			const empty = new Set<string>();
			cachedFolloweeIds = empty;
			return empty;
		})
		.finally(() => {
			loadingFolloweeIds = null;
		});

	return loadingFolloweeIds;
}

/**
 * 必要な場合だけフォロー一覧の先読みを行う。
 *
 * @param userId - ログインユーザ ID
 * @param emojis - 判定対象の絵文字配列
 * @returns なし
 * @internal
 */
export async function preloadFolloweeIdsIfNeeded(
	userId: string | null | undefined,
	emojis: readonly EmojiForMotifCheck[] | null | undefined,
): Promise<void> {
	if (!userId || !needsMotifAnyFollowCheck(emojis)) return;
	await getFolloweeIdsForMotifCheck(userId);
}
