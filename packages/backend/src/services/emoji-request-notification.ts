/**
 * @packageDocumentation
 *
 * 絵文字申請（追加・インポート・変更）の通知を送る。
 *
 * @remarks
 * 通知の種類は emojiRequest。どの申請か（種類・ID・宛先）を一緒に保存し、押したときにその申請を開けるようにする（R5）。
 * - 申請者宛ては、メインアイコンに申請した絵文字の画像（無ければサーバーのアイコン）
 * - 管理者宛ては、ほかの通知とそろえて、メインアイコンに申請者（notifier）を出す。申請者が分からない（過去の取り込み）ときは絵文字の画像
 * - どちらも右下の小さなアイコンは「絵文字申請」のマーク（画面側で出す）
 * - 管理者宛ては isAdmin のローカルユーザー全員（インポート申請と同じく、モデレーターには送らない）
 * - 送信は待たずに裏で行う（申請・審査の API の応答を遅らせないため）
 *
 * @internal
 */
import { IsNull } from "typeorm";
import config from "@/config/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { createNotification } from "@/services/create-notification.js";
import { Users } from "@/models/index.js";
import type { EmojiRequestKind } from "@/misc/emoji-request-link.js";
import type { User } from "@/models/entities/user.js";

/** 通知の中身 */
type EmojiRequestNotice = {
	/** 申請の種類 */
	kind: EmojiRequestKind;
	/** 申請の ID */
	requestId: string;
	/** 見出し */
	header: string;
	/** 本文 */
	body: string;
	/** 申請した絵文字の画像 URL（無ければサーバーのアイコンを使う） */
	icon?: string | null;
};

/**
 * サーバーのアイコン URL を返す（絵文字の画像が無いときの代わり）。
 *
 * @returns 絶対 URL、または undefined
 */
async function getInstanceIconUrl(): Promise<string | undefined> {
	const meta = await fetchMeta();
	if (meta?.iconUrl == null) return undefined;
	if (meta.iconUrl.startsWith("http")) return meta.iconUrl;
	return `${config.url}${meta.iconUrl.startsWith("/") ? "" : "/"}${meta.iconUrl}`;
}

/**
 * 申請者に通知する。申請者が分からない（過去の取り込み）ときは何もしない。
 *
 * @param requesterId - 申請者
 * @param notice - 通知の中身
 * @internal
 */
export function notifyEmojiRequestRequester(
	requesterId: User["id"] | null,
	notice: EmojiRequestNotice,
): void {
	if (requesterId == null) return;
	setImmediate(async () => {
		createNotification(requesterId, "emojiRequest", {
			customHeader: notice.header,
			customBody: notice.body,
			customIcon: notice.icon ?? (await getInstanceIconUrl()) ?? null,
			emojiRequestKind: notice.kind,
			emojiRequestId: notice.requestId,
			emojiRequestRole: "requester",
		});
	});
}

/**
 * 管理者（isAdmin のローカルユーザー）全員に通知する。押すと審査画面のその申請を開く。
 *
 * @remarks
 * 申請者を notifier にするので、通知一覧では申請者のアイコンが出る。
 * 管理者が自分で申請したときは、自分宛ての通知は送られない（createNotification の決まり）。
 *
 * @param notice - 通知の中身
 * @param requesterId - 申請者（分からなければ null）
 * @internal
 */
export function notifyEmojiRequestReviewers(
	notice: EmojiRequestNotice,
	requesterId: User["id"] | null,
): void {
	setImmediate(async () => {
		const admins = await Users.find({ where: { isAdmin: true, host: IsNull() }, select: ["id"] });
		const icon = notice.icon ?? (await getInstanceIconUrl()) ?? null;
		for (const admin of admins) {
			createNotification(admin.id, "emojiRequest", {
				customHeader: notice.header,
				customBody: notice.body,
				customIcon: icon,
				emojiRequestKind: notice.kind,
				emojiRequestId: notice.requestId,
				emojiRequestRole: "reviewer",
				...(requesterId ? { notifierId: requesterId } : {}),
			});
		}
	});
}
