/**
 * @packageDocumentation
 *
 * user.lastActiveDate 更新を間引くヘルパ。
 *
 * @remarks
 * リアクション・投票・投稿・接続など高頻度アクションのたびに user.lastActiveDate を更新すると、
 * 索引付き列（user.lastActiveDate）への大量更新で HOT 更新が効かず、WAL・索引・テーブル肥大の原因になる。
 * 直近 {@link THROTTLE_MS} 以内に更新済みの場合は DB 書き込みを省略する（ワーカープロセスごとのメモリで判定）。
 *
 * オンライン判定は USER_ONLINE_THRESHOLD(5分) 単位のため、1分間引きでは実用上の劣化はない。
 * @internal
 */
import { Users } from "@/models/index.js";

/** DB 書き込みを間引く最小間隔（ms）。USER_ONLINE_THRESHOLD(5分) より十分小さくすること。 */
const THROTTLE_MS = 60 * 1000;

/** userId -> 最後に DB へ書き込んだ時刻(ms)。アクセス順で並ぶよう delete+set で更新する。 */
const lastWrittenAt = new Map<string, number>();
/** メモリ肥大防止の上限。超過時はアクセスが古いものから間引く。 */
const MAX_ENTRIES = 100_000;

/**
 * user.lastActiveDate を更新する。ただし直近 {@link THROTTLE_MS} 以内に更新済みなら DB 書き込みを省略する。
 * DB 書き込みは既存挙動同様 fire-and-forget（結果を待たない）。
 *
 * @param userId 対象ユーザ ID
 * @param when 記録する時刻（既定は現在時刻）
 */
export function touchLastActiveDate(
	userId: string,
	when: Date = new Date(),
): void {
	const now = when.getTime();
	const prev = lastWrittenAt.get(userId);
	if (prev != null && now - prev < THROTTLE_MS) return;

	// アクセス順を保つため一度削除してから末尾に追加する
	lastWrittenAt.delete(userId);
	lastWrittenAt.set(userId, now);

	if (lastWrittenAt.size > MAX_ENTRIES) {
		const dropCount = Math.floor(MAX_ENTRIES / 10);
		let i = 0;
		for (const key of lastWrittenAt.keys()) {
			lastWrittenAt.delete(key);
			if (++i >= dropCount) break;
		}
	}

	void Users.update(userId, { lastActiveDate: when }).catch(() => {});
}
