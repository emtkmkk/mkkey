/**
 * @packageDocumentation
 *
 * 通知の作成と配信を行うサービス。
 *
 * @remarks
 * - **役割**: リアクション・フォロー・メンション等の通知を DB に保存し、ストリーム・プッシュ・メールで配信する。
 * - CHANGED: 種別ミュート（`isRead: true`）の通知はプッシュも送らない（設定 UI と整合）。
 * - NOTE: 実験的通知種別のプッシュ検証時は、設定で該当種別を ON（ミュート解除）してから試すこと。
 *
 * @see {@link services/note/reaction/create} リアクション作成
 * @internal
 */

import { publishMainStream } from "@/services/stream.js";
import { pushNotification } from "@/services/push-notification.js";
import {
	Notifications,
	Mutings,
	NoteThreadMutings,
	UserProfiles,
	Users,
	Followings,
} from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import type { User } from "@/models/entities/user.js";
import type { Notification } from "@/models/entities/notification.js";
import { sendEmailNotification } from "./send-email-notification.js";
import { shouldSilenceInstance } from "@/misc/should-block-instance.js";

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

	const packed = await Notifications.pack(notification, {});

	// 通知イベントを発行
	publishMainStream(notifieeId, "notification", packed);

	// 3秒経っても(今回作成した)通知が既読にならなかったら「未読の通知がありますよ」イベントを発行する
	setTimeout(async () => {
		const fresh = await Notifications.findOneBy({ id: notification.id });
		if (fresh == null) return; // 既に削除されているかもしれない
		// 種別ミュート・手動既読は isRead=true。プッシュもアプリ内表示と同様に抑止する
		if (fresh.isRead) return;

		await pushNotification(notifieeId, "notification", packed);

		//#region ただしミュートしているユーザーからの通知なら無視
		const isNotifierMuted =
			data.notifierId != null
				? await Mutings.exist({
						where: {
							muterId: notifieeId,
							muteeId: data.notifierId,
						},
					})
				: false;
		if (isNotifierMuted) {
			return;
		}
		//#endregion

		publishMainStream(notifieeId, "unreadNotification", packed);

		if (type === "follow")
			sendEmailNotification.follow(
				notifieeId,
				await Users.findOneByOrFail({ id: data.notifierId! }),
			);
		if (type === "receiveFollowRequest")
			sendEmailNotification.receiveFollowRequest(
				notifieeId,
				await Users.findOneByOrFail({ id: data.notifierId! }),
			);
	}, 3000);

	return notification;
}
