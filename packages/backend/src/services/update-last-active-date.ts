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
 *
 * 2 種類の経路がある:
 * - {@link touchLastActiveDate}: 操作系（リアクション・投稿など）。`lastActiveDate` だけを書く。
 * - {@link touchLastActiveDateOnLogin}: 認証成功時。`inactiveDeletionWarnedAt` のクリアと
 *   休眠フォロワーキャッシュの無効化も伴うので、間引きの記録を別に持つ。
 *
 * NOTE: 間引きはワーカーごとのメモリなので、web ワーカーが N 個あれば最大 N 回/分/ユーザー書き込まれる。
 * それでも「毎リクエスト」からは大幅に減る。
 * @internal
 */
import { Users } from "@/models/index.js";
import { maybeInvalidateDormantFollowerCacheOnActivity } from "@/remote/activitypub/dormant-follower-check.js";

/** DB 書き込みを間引く最小間隔（ms）。USER_ONLINE_THRESHOLD(5分) より十分小さくすること。 */
const THROTTLE_MS = 60 * 1000;

/** userId -> 最後に DB へ書き込んだ時刻(ms)。アクセス順で並ぶよう delete+set で更新する。 */
const lastWrittenAt = new Map<string, number>();
/**
 * userId -> 認証経路で最後に DB へ書き込んだ時刻(ms)。
 *
 * @remarks
 * {@link lastWrittenAt} と分けているのは、操作系の書き込み直後に認証が来たとき
 * `inactiveDeletionWarnedAt` のクリアと休眠キャッシュの無効化が飛ばされないようにするため。
 */
const lastLoginWrittenAt = new Map<string, number>();
/** メモリ肥大防止の上限。超過時はアクセスが古いものから間引く。 */
const MAX_ENTRIES = 100_000;

/**
 * 間引き判定と記録を行う。
 *
 * @param map - 記録先（経路ごとに別）
 * @param userId - 対象ユーザ ID
 * @param now - 現在時刻(ms)
 * @returns 書き込むべきなら true。直近 {@link THROTTLE_MS} 以内に記録があれば false
 * @internal
 */
function claimWrite(map: Map<string, number>, userId: string, now: number): boolean {
	const prev = map.get(userId);
	if (prev != null && now - prev < THROTTLE_MS) return false;

	// アクセス順を保つため一度削除してから末尾に追加する
	map.delete(userId);
	map.set(userId, now);

	if (map.size > MAX_ENTRIES) {
		const dropCount = Math.floor(MAX_ENTRIES / 10);
		let i = 0;
		for (const key of map.keys()) {
			map.delete(key);
			if (++i >= dropCount) break;
		}
	}
	return true;
}

/**
 * user.lastActiveDate を更新する。ただし直近 {@link THROTTLE_MS} 以内に更新済みなら DB 書き込みを省略する。
 * DB 書き込みは既存挙動同様 fire-and-forget（結果を待たない）。
 *
 * @param userId 対象ユーザ ID
 * @param when 記録する時刻（既定は現在時刻）
 * @public
 */
export function touchLastActiveDate(
	userId: string,
	when: Date = new Date(),
): void {
	if (!claimWrite(lastWrittenAt, userId, when.getTime())) return;

	void Users.update(userId, { lastActiveDate: when }).catch(() => {});
}

/**
 * 認証成功時に lastActiveDate を更新し、休眠関連の状態も戻す。直近 {@link THROTTLE_MS} 以内に実行済みなら何もしない。
 *
 * @remarks
 * 間引き窓の初回だけ、次の 3 つを従来どおり行う:
 * 1. 更新前の `lastActiveDate` を読み、30 日以上休眠していた場合は休眠フォロワーのスキップキャッシュを無効化する
 *    （{@link maybeInvalidateDormantFollowerCacheOnActivity}）。認証キャッシュのユーザーには `lastActiveDate` が無いので DB から読む。
 * 2. `lastActiveDate` を今にする。
 * 3. `inactiveDeletionWarnedAt` を `null` に戻し、再度 3 ヶ月以上未活動になったときに警告メールを再送できるようにする。
 *
 * 2 回目以降の 1 分以内は、これらは既に済んでいるので省略しても結果は同じ。
 * 操作系の {@link touchLastActiveDate} 側の記録にも書き込み時刻を載せ、直後の操作で二重に書かないようにする。
 *
 * NOTE: ストリーミング接続だけの活動更新ではここは通らないため、日次ジョブ側でも再活動ユーザーのフラグ掃除を行う。
 *
 * @param user - 認証に成功したローカルユーザー（`id` と `host`）
 * @returns Promise（休眠キャッシュの無効化まで待つ。`lastActiveDate` の UPDATE は待たない）
 * @public
 */
export async function touchLastActiveDateOnLogin(user: {
	id: string;
	host: string | null;
}): Promise<void> {
	const now = Date.now();
	if (!claimWrite(lastLoginWrittenAt, user.id, now)) return;

	const prev = await Users.findOne({
		where: { id: user.id },
		select: ["lastActiveDate", "host"],
	});
	await maybeInvalidateDormantFollowerCacheOnActivity(
		user.id,
		prev?.host ?? user.host ?? null,
		prev?.lastActiveDate ?? null,
	);

	// 操作系の間引きにも記録して、直後の touchLastActiveDate の書き込みを省く
	claimWrite(lastWrittenAt, user.id, now);

	// 再ログインで休眠サイクルを終了し、警告メールの「1回限り」フラグをリセットする
	void Users.update(user.id, {
		lastActiveDate: new Date(now),
		inactiveDeletionWarnedAt: null,
	}).catch(() => {});
}
