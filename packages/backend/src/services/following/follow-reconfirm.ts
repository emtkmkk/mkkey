/**
 * @packageDocumentation
 *
 * フォロー申請拒否・フォロー強制解除後の再フォロー確認レコードを管理する。
 *
 * @remarks
 * - 記録はローカルユーザー（申請した側 / フォローを外された側）のみ。
 * - Web UI がダイアログ承認後に {@link ackFollowReconfirm} で削除する。
 *
 * @internal
 */
import type { User } from "@/models/entities/user.js";
import type { FollowReconfirmReason } from "@/models/entities/follow-reconfirm.js";
import { FollowReconfirms, Users } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { createNotification } from "@/services/create-notification.js";

/**
 * 再フォロー確認が必要な関係を upsert する。
 *
 * @param userId - 申請した側 / フォローを外された側（ローカルのみ記録）
 * @param targetUserId - 拒否した側 / 強制解除した側
 * @param reason - ダイアログ文面の分岐用
 * @internal
 */
export async function upsertFollowReconfirm(
	userId: User["id"],
	targetUserId: User["id"],
	reason: FollowReconfirmReason,
): Promise<void> {
	if (userId === targetUserId) return;

	const user = await Users.findOneBy({ id: userId });
	if (user == null || !Users.isLocalUser(user)) {
		return;
	}

	const now = new Date();
	const existing = await FollowReconfirms.findOneBy({
		userId,
		targetUserId,
	});

	if (existing != null) {
		await FollowReconfirms.update(existing.id, {
			reason,
			updatedAt: now,
		});
		return;
	}

	await FollowReconfirms.insert({
		id: genId(),
		createdAt: now,
		updatedAt: now,
		userId,
		targetUserId,
		reason,
	});
}

/**
 * 再フォロー確認ダイアログを承認したあと、対応レコードを削除する。
 *
 * @param userId - 操作ユーザー
 * @param targetUserId - 再フォロー対象
 * @returns 削除したか
 * @internal
 */
export async function ackFollowReconfirm(
	userId: User["id"],
	targetUserId: User["id"],
): Promise<boolean> {
	const result = await FollowReconfirms.delete({
		userId,
		targetUserId,
	});
	return (result.affected ?? 0) > 0;
}

/**
 * ローカルフォロワーに「フォロー申請が拒否された」通知を送る。
 *
 * @param follower - 申請した側（ローカルのみ通知）
 * @param followee - 拒否したフォロー先（notifier）
 * @internal
 */
export async function notifyFollowRequestRejected(
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
		"followRequestRejected",
		{
			notifierId: followee.id,
		},
		{ notifier },
	);
}
