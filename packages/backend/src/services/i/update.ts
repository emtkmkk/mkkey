/**
 * @packageDocumentation
 *
 * ローカルユーザーのプロフィールが変わったことを、外部（ActivityPub のフォロワー・リレー・Bluesky ブリッジ）へ知らせる。
 *
 * @remarks
 * - 呼び出し元は `i/update`（プロフィールの保存）と `i/known-as`（別名の設定）。
 *
 * @internal
 */
import renderUpdate from "@/remote/activitypub/renderer/update.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import { renderPerson } from "@/remote/activitypub/renderer/person.js";
import { deliverToFollowers } from "@/remote/activitypub/deliver-manager.js";
import { deliverToRelays } from "../relay.js";
import { syncAtprotoProfile } from "@/remote/atproto/identity.js";

/**
 * プロフィールの変更を外部へ知らせる。
 *
 * @remarks
 * - ActivityPub の `Update`（Person）を、フォロワーとリレーへ配る。
 * - Bluesky ブリッジにオプトインしていれば、Bluesky のプロフィールも書き直す。
 *   こちらは待たずに進める（中で失敗をログに残す）。
 * - NOTE: 呼び出し元の `i/update` は、設定を 1 つ変えただけでも呼ぶ。Bluesky 側は、表示名・アイコン・バナーが
 *   変わっていなければ書かない。
 *
 * @param userId - プロフィールが変わったユーザー
 * @throws ユーザーが見つからないとき
 * @internal
 */
export async function publishToFollowers(userId: User["id"]) {
	const user = await Users.findOneBy({ id: userId });
	if (user == null) throw new Error("user not found");

	// フォロワーがリモートユーザーかつ投稿者がローカルユーザーならUpdateを配信
	if (Users.isLocalUser(user)) {
		const content = renderActivity(
			renderUpdate(await renderPerson(user), user),
		);
		deliverToFollowers(user, content);
		deliverToRelays(user, content);

		// Bluesky ブリッジにオプトインしていれば、Bluesky のプロフィールも書き直す（待たない。失敗はログだけ）
		syncAtprotoProfile(user);
	}
}
