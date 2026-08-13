/**
 * @packageDocumentation
 *
 * アカウント削除（ソフト削除・ジョブ登録）を行うサービス。
 *
 * @remarks
 * - **役割**: アカウント削除 API から呼ばれ、フォロワー通知・ソフト削除・削除ジョブ登録を行う。
 * - `followedAccountWasDeleted` は `isDeleted` 更新前に送り、通知 pack 時の表示名置換を避ける。
 *
 * @see {@link queue/processors/db/delete-account} アカウント削除キュー
 * @internal
 */

import { AccessTokens, Users } from "@/models/index.js";
import { createDeleteAccountJob } from "@/queue/index.js";
import { publishInternalEvent, publishUserEvent } from "./stream.js";
import { doPostSuspend } from "./suspend-user.js";
import { notifyFollowersAccountWasDeleted } from "./notify-followers-account-was-deleted.js";

/**
 * 削除済みアカウントの資格情報を失効させ、認証キャッシュを無効化する。
 *
 * @param user - 削除対象のユーザー（`host` が null ならローカル）
 * @returns Promise
 * @remarks
 * - 削除はソフト削除で `user` 行が残るため、明示的に破棄しないとトークンが生き続け、
 *   削除後も API / ストリームが利用できてしまう。
 * - `isDeleted` を **書き込んだ後** に呼ぶこと。先に呼ぶと、並行リクエストが
 *   `isDeleted: false` のまま認証キャッシュを再作成してしまう。
 * - 認証キャッシュは Redis 側に TTL 120 秒で残るため、内部イベントでの無効化が必須。
 * @see {@link authenticate} 認証キャッシュ
 * @internal
 */
export async function revokeCredentialsForDeletedUser(user: {
	id: string;
	host: string | null;
}): Promise<void> {
	const isLocal = user.host == null;

	if (isLocal) {
		// アプリ / MiAuth のアクセストークンを破棄する
		await AccessTokens.delete({ userId: user.id });
		// ネイティブトークン（Web セッション）を破棄する
		await Users.update(user.id, { token: null });
	}

	// isDeleted・token の変更を各ワーカーの認証キャッシュへ伝播させる
	publishInternalEvent(isLocal ? "localUserUpdated" : "remoteUserUpdated", {
		id: user.id,
	});
}

export async function deleteAccount(user: {
	id: string;
	host: string | null;
}): Promise<void> {
	const target = await Users.findOneByOrFail({ id: user.id });

	// 物理削除する前にDelete activityを送信する
	await doPostSuspend(user).catch((e) => {});

	// isDeleted 更新前に通知内容を作成する（Users.pack の削除済み置換より前）
	const followedDeletedNotified =
		await notifyFollowersAccountWasDeleted(target);

	createDeleteAccountJob(user, {
		soft: true,
		followedDeletedNotifiedIds: [...followedDeletedNotified],
	});

	await Users.update(user.id, {
		isDeleted: true,
	});

	// トークンを失効させる（ソフト削除なので明示的に破棄しないと投稿できてしまう）
	await revokeCredentialsForDeletedUser(user);

	// ストリーミングを終了
	publishUserEvent(user.id, "terminate", {});
}
