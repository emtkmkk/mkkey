/**
 * @packageDocumentation
 *
 * ユーザー凍結（Delete 配信等）を行うサービス。
 *
 * @remarks
 * - **役割**: 管理者による凍結処理とアカウント削除で呼ばれ、ローカルユーザーは Delete を配信し、内部イベントで状態を通知する。
 * - Delete（ユーザー）の送り先は、知っているすべての共有 inbox、このサーバーのリレーの相手、外部のリレー。
 *   アカウント削除では、相手のサーバーで投稿まで消してもらうのをこの 1 回に任せる
 *   （Mastodon・Misskey 系は、ユーザーの Delete を受け取るとその人の投稿をまとめて消す）。
 *   投稿ごとの Delete は送らない（{@link queue/processors/db/delete-account}）。
 * - 届かなかったサーバーには、削除済みの人の投稿やアクターを取りに来たときに送り直す
 *   （{@link server/activitypub} の resendDeleteAccount）。
 *
 * @see {@link endpoints/admin/suspend-user} 凍結 API
 * @internal
 */
import renderDelete from "@/remote/activitypub/renderer/delete.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { deliver } from "@/queue/index.js";
import config from "@/config/index.js";
import type { User } from "@/models/entities/user.js";
import { Users, Followings } from "@/models/index.js";
import { Not, IsNull } from "typeorm";
import { publishInternalEvent } from "@/services/stream.js";
import { apLogger } from "@/remote/activitypub/logger.js";
import { getLocalRelayInboxes } from "./local-relay.js";
import { deliverToRelays } from "./relay.js";

export async function doPostSuspend(user: {
	id: User["id"];
	host: User["host"];
}) {
	publishInternalEvent("userChangeSuspendedState", {
		id: user.id,
		isSuspended: true,
	});

	if (Users.isLocalUser(user)) {
		// 既知のすべての SharedInbox に Delete を送信
		const content = renderActivity(
			renderDelete(`${config.url}/users/${user.id}`, user),
		);

		// 送り先の共有 inbox（重複を除く）。以前は配列の includes で重複を除いていた
		const queue = new Set<string>();

		const followings = await Followings.find({
			where: [
				{ followerSharedInbox: Not(IsNull()) },
				{ followeeSharedInbox: Not(IsNull()) },
			],
			select: ["followerSharedInbox", "followeeSharedInbox"],
		});

		const inboxes = followings.map(
			(x) => x.followerSharedInbox || x.followeeSharedInbox,
		);

		apLogger.info(`delete Activity Send: ${inboxes.length}`);

		for (const inbox of inboxes) {
			if (inbox != null) queue.add(inbox);
		}

		for (const inbox of queue) {
			deliver(user, content, inbox, true);
		}
		// 通常フォローのないリレー相手にも、削除・凍結を確実に知らせる。
		for (const [inbox, shared] of await getLocalRelayInboxes({ userHost: null, visibility: "public", localOnly: false, channelId: null })) {
			if (queue.has(inbox)) continue;
			queue.add(inbox);
			await deliver(user, content, inbox, shared);
		}
		// 外部のリレーにも送る。リレー経由でしか投稿を受け取っていないサーバーは、
		// 共有 inbox の一覧に入っていないことがあるため。
		// 以前はアカウント削除で投稿ごとの Delete がリレーに届いていたが、それをやめた代わりにここで 1 回だけ送る
		await deliverToRelays(user, content, queue);
	}
}
