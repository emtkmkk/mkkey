/**
 * @packageDocumentation
 *
 * アカウント削除前に、フォロワーへ `followedAccountWasDeleted` 通知を送る。
 *
 * @remarks
 * - **役割**: 削除対象ユーザーの `isDeleted` 更新より前に呼び、フォロワーへ削除通知を送る。
 * - 表示名は `customBody` にスナップショット保存し、一覧再取得後も名前を維持する。
 * - 返却した ID 集合は削除ジョブ側で相互フォロー時の `userWasUnfollowed` 重複抑止に使う。
 *
 * @see {@link services/delete-account} アカウント削除 API
 * @see {@link queue/processors/db/delete-account} アカウント削除キュー
 * @internal
 */

import type { User } from "@/models/entities/user.js";
import { Followings, Users } from "@/models/index.js";
import { createNotification } from "@/services/create-notification.js";
import { MoreThan } from "typeorm";

/**
 * 削除対象をフォローしているローカルユーザーへ、アカウント削除通知を送る。
 *
 * @param user - 削除対象（`isDeleted` が false の状態で呼ぶこと）
 * @returns 通知を送ったローカルフォロワーの userId 集合
 * @internal
 */
export async function notifyFollowersAccountWasDeleted(
	user: User,
): Promise<Set<string>> {
	const notified = new Set<string>();
	let cursor: User["id"] | null = null;

	while (true) {
		const relations = await Followings.find({
			where: {
				followeeId: user.id,
				...(cursor ? { followerId: MoreThan(cursor) } : {}),
			},
			take: 100,
			order: { followerId: "ASC" },
		});

		if (relations.length === 0) {
			break;
		}

		for (const relation of relations) {
			cursor = relation.followerId;

			const follower = await Users.findOneBy({ id: relation.followerId });
			if (follower == null || !Users.isLocalUser(follower)) {
				continue;
			}

			notified.add(follower.id);
			// フォロワー視点の表示名（メモのカスタム名含む）を customBody に保存する
			const packedNotifier = await Users.pack(user, { id: follower.id });
			const displayName = packedNotifier.name || packedNotifier.username;
			// NOTE: isDeleted 更新前の user を notifier として渡し、リアルタイム配信時の pack も正しくする
			await createNotification(
				follower.id,
				"followedAccountWasDeleted",
				{ notifierId: user.id, customBody: displayName },
				{ notifier: user },
			);
		}
	}

	return notified;
}
