/**
 * @packageDocumentation
 *
 * 通知の作成と配信を行うサービス。
 *
 * @remarks
 * - **役割**: リアクション・フォロー・メンション等の通知を DB に保存し、ストリーム・プッシュ・メールで配信する。
 * - CHANGED: 種別ミュート（`isRead: true`）の通知はプッシュも送らない（設定 UI と整合）。
 * - CHANGED: ユーザミュート・インスタンスミュート・サスペンドはプッシュ前に判定する。
 * - NOTE: 実験的通知種別のプッシュ検証時は、設定で該当種別を ON（ミュート解除）してから試すこと。
 * - NOTE: `options.notifier` を渡した場合は pack 時に再利用し、削除済みユーザーの表示名置換を避ける。
 * - TODO: メール通知実装時に sendEmailNotification 呼び出しを復活すること。
 *
 * @see {@link services/note/reaction/create} リアクション作成
 * @internal
 */

import { publishMainStream } from "@/services/stream.js";
import { pushNotification } from "@/services/push-notification.js";
import Logger from "@/services/logger.js";
import {
	Notifications,
	NoteThreadMutings,
	UserProfiles,
	Users,
	Followings,
} from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import type { User } from "@/models/entities/user.js";
import type { Notification } from "@/models/entities/notification.js";
import { shouldSilenceInstance } from "@/misc/should-block-instance.js";
import { shouldDeliverDelayedNotification } from "@/services/should-deliver-delayed-notification.js";

const notificationLogger = new Logger("notification");

/**
 * 通知を作成する。
 * notifier を渡すと、notifierId での Users.findOneBy をスキップして再利用する（呼び出し元で既に取得済みのとき用）。
 *
 * @param notifieeId - 通知先ユーザ ID
 * @param type - 通知種別
 * @param data - 通知データ（notifierId など）
 * @param options - notifier を渡すと DB 取得をスキップ
 * @internal
 */
export async function createNotification(
	notifieeId: User["id"],
	type: Notification["type"],
	data: Partial<Notification>,
	options?: { notifier?: User | null },
) {
	if (data.notifierId && notifieeId === data.notifierId) {
		return null;
	}

	if (
		data.notifierId &&
		[
			"mention",
			"reply",
			"renote",
			"quote",
			"reaction",
			"unreadAntenna",
		].includes(type)
	) {
		const notifier =
			options?.notifier != null && options.notifier.id === data.notifierId
				? options.notifier
				: await Users.findOneBy({ id: data.notifierId });
		// 通知元が存在しないかサイレンスされている場合は通知を抑制
		if (!notifier) return null;

		// 通知元がサイレンス中、またはサイレンスインスタンスに所属し、かつ通知先にフォローされていない場合は抑制
		const [shouldSilence, isFollowed] = await Promise.all([
			Users.isRemoteUser(notifier) && shouldSilenceInstance(notifier.host),
			Followings.exist({ where: { followerId: notifieeId, followeeId: data.notifierId } }),
		]);

		if ((notifier.isSilenced || shouldSilence) && !isFollowed) {
			return null;
		}
	}

	const profilePromise = UserProfiles.findOneBy({ userId: notifieeId });

	const threadMutePromise = data.note != null ? NoteThreadMutings.findOneBy({
		userId: notifieeId,
		threadId: data.note.threadId || data.note.id,
	}) : Promise.resolve(null);

	const [profile, threadMute] = await Promise.all([profilePromise, threadMutePromise]);

	const isMuted = profile?.mutingNotificationTypes.includes(type);

	if (threadMute) {
		return null;
	}

	// 通知を作成
	const notification = await Notifications.insert({
		id: genId(),
		createdAt: new Date(),
		notifieeId: notifieeId,
		type: type,
		// 相手がこの通知をミュートしているようなら、既読を予めつけておく
		isRead: isMuted,
		...data,
	} as Partial<Notification>).then((x) =>
		Notifications.findOneByOrFail(x.identifiers[0]),
	);

	// 呼び出し元で notifier を渡している場合は pack 時に再利用する（削除済み置換前の表示を保持）
	const notifierUserMap =
		options?.notifier != null &&
		data.notifierId != null &&
		options.notifier.id === data.notifierId
			? new Map<User["id"], User>([[options.notifier.id, options.notifier]])
			: undefined;

	const packed = await Notifications.pack(notification, {
		_notifierUserMap_: notifierUserMap,
	});

	// フォローブロック等で pack が null のときは配信しない（DB には残る）
	if (packed != null) {
		publishMainStream(notifieeId, "notification", packed);
	}

	// 3秒経っても(今回作成した)通知が既読にならなかったら「未読の通知がありますよ」イベントを発行する
	if (packed != null) {
		setTimeout(async () => {
			try {
				const fresh = await Notifications.findOneBy({ id: notification.id });
				if (fresh == null) return; // 既に削除されているかもしれない
				// 種別ミュート・手動既読は isRead=true。プッシュもアプリ内表示と同様に抑止する
				if (fresh.isRead) return;

				const deliver = await shouldDeliverDelayedNotification(
					notifieeId,
					data.notifierId,
				);
				if (!deliver) return;

				await pushNotification(notifieeId, "notification", packed);
				publishMainStream(notifieeId, "unreadNotification", packed);
			} catch (err) {
				notificationLogger.error("delayed notification delivery failed", { err });
			}
		}, 3000);
	}

	return notification;
}
