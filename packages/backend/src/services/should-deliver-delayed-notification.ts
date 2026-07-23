/**
 * @packageDocumentation
 *
 * 3 秒遅延後のプッシュ / unreadNotification 配信可否を判定する。
 *
 * @remarks
 * - i/notifications の一覧フィルタと整合させる（ユーザミュート・インスタンスミュート・サスペンド）。
 *
 * @internal
 */

import { Mutings, UserProfiles, Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import { hasMuteScope } from "@/misc/mute-scope.js";

/**
 * 遅延配信（プッシュ・unreadNotification）を行ってよいか。
 *
 * @param notifieeId - 通知先ユーザ ID
 * @param notifierId - 通知元ユーザ ID（無い種別は null）
 * @param scope - 判定する配送経路。アプリ内通知とWeb Pushを分離する
 * @returns 配信してよいとき true
 * @public
 */
export async function shouldDeliverDelayedNotification(
	notifieeId: User["id"],
	notifierId: User["id"] | null | undefined,
	scope: "notification" | "push" = "notification",
): Promise<boolean> {
	if (notifierId == null) {
		return true;
	}

	const muting = await Mutings.findOne({
		where: {
			muterId: notifieeId,
			muteeId: notifierId,
		},
	});
	if (muting != null && hasMuteScope(muting.scope, scope)) {
		return false;
	}

	const notifier = await Users.findOneBy({ id: notifierId });
	if (notifier == null || notifier.isSuspended) {
		return false;
	}

	if (notifier.host != null) {
		const profile = await UserProfiles.findOneBy({ userId: notifieeId });
		const mutedInstances = profile?.mutedInstances;
		if (
			Array.isArray(mutedInstances) &&
			mutedInstances.includes(notifier.host)
		) {
			return false;
		}
	}

	return true;
}
