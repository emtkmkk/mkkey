/**
 * @packageDocumentation
 *
 * 意図しないフォロー解除（wasForciblyUnfollowed）通知の送信。
 *
 * @remarks
 * - フォロワー（ローカル）が、フォロー先の操作により Followings が削除されたときに使う。
 * - {@link following/delete} の kickFollower、{@link following/reject} の remoteReject などから呼ぶ。
 *
 * @internal
 */

import type { User } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import { createNotification } from "@/services/create-notification.js";

/**
 * ローカルフォロワーに「フォローが強制解除された」通知を送る。
 *
 * @param follower - フォローが切れた側（ローカルのみ通知）
 * @param followee - 操作したフォロー先（notifier）
 * @internal
 */
export async function notifyWasForciblyUnfollowed(
	follower: { id: User["id"]; host: User["host"] },
	followee: { id: User["id"]; host: User["host"] },
): Promise<void> {
	if (!Users.isLocalUser(follower)) {
		return;
	}

	const notifier = await Users.findOneBy({ id: followee.id });
	if (notifier == null) {
		return;
	}

	await createNotification(
		follower.id,
		"wasForciblyUnfollowed",
		{
			notifierId: followee.id,
		},
		{ notifier },
	);
}
