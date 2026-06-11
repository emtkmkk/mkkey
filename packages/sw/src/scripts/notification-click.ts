/**
 * @packageDocumentation
 *
 * プッシュ通知クリック時の遷移解決。
 *
 * @remarks
 * - `view` は原則タップ既定と同じ。R5（renote / reaction）のみノートを開く。
 * - R4 種別のタップ・表示は通知一覧へ遷移する。
 *
 * @internal
 */

import type { pushNotificationDataMap } from "@/types";
import * as swos from "@/scripts/operations";
import { acct as getAcct } from "@/filters/user";
import {
	isR4NotificationType,
	isR5NotificationType,
} from "@/scripts/notification-actions";

type NotificationPushData = pushNotificationDataMap["notification"];

/** compose / push 時に付与するクリック用メタ（SW 内部） */
type NotificationClickMetaBody = NotificationPushData["body"] & {
	_clickEffectiveType?: string;
	viewNoteId?: string;
	renoteTargetNoteId?: string;
};

/**
 * クリック処理用の実効種別を返す。
 *
 * @remarks
 * notification.data から `type` が欠落しても compose 時の値を優先する。
 *
 * @param body - 通知 body
 * @internal
 */
export function getEffectiveNotificationType(
	body: NotificationClickMetaBody,
): string {
	if (typeof body._clickEffectiveType === "string") {
		return body._clickEffectiveType;
	}
	return typeof body.type === "string" ? body.type : "";
}

/**
 * R5 の「表示」action で開く noteId を返す。
 *
 * @param body - 通知 body
 * @internal
 */
/**
 * showNotification に渡す data にクリック用メタを付与する。
 *
 * @param data - 元の push データ
 * @param effectiveType - compose 時点の実効種別
 * @param meta - 追加メタ
 * @public
 */
export function withNotificationClickMeta(
	data: NotificationPushData,
	effectiveType: string,
	meta?: { viewNoteId?: string },
): NotificationPushData {
	return {
		...data,
		body: {
			...data.body,
			_clickEffectiveType: effectiveType,
			...(meta?.viewNoteId != null ? { viewNoteId: meta.viewNoteId } : {}),
		} as NotificationPushData["body"],
	};
}

export function resolveR5ViewNoteId(
	body: NotificationClickMetaBody,
): string | undefined {
	if (typeof body.viewNoteId === "string") {
		return body.viewNoteId;
	}
	if (getEffectiveNotificationType(body) === "renote") {
		return getRenoteTargetNoteId(body);
	}
	const note = "note" in body ? body.note : undefined;
	return typeof note?.id === "string" ? note.id : undefined;
}

/**
 * RT 先ノート ID をペイロードから取得する。
 *
 * @param body - 通知 body
 * @returns RT 先 noteId（無いとき undefined）
 * @internal
 */
function getRenoteTargetNoteId(
	body: NotificationClickMetaBody,
): string | undefined {
	if (typeof body.renoteTargetNoteId === "string") {
		return body.renoteTargetNoteId;
	}
	const note = "note" in body ? body.note : undefined;
	if (note == null) return undefined;
	const renoteId = (note as { renoteId?: string }).renoteId;
	if (typeof renoteId === "string") return renoteId;
	const renote = (note as { renote?: { id?: string } }).renote;
	return typeof renote?.id === "string" ? renote.id : undefined;
}

/**
 * 通知一覧を開く。
 *
 * @param loginId - ログイン ID
 * @internal
 */
async function openNotifications(
	loginId: string,
): Promise<WindowClient | null> {
	return swos.openClient("push", "/my/notifications", loginId);
}

/**
 * R5 の「表示」action 用にノートを開く。
 *
 * @param data - push データ
 * @param loginId - ログイン ID
 * @internal
 */
async function openR5ViewNote(
	data: NotificationPushData,
	loginId: string,
): Promise<WindowClient | null> {
	const viewNoteId = resolveR5ViewNoteId(
		data.body as NotificationClickMetaBody,
	);
	if (viewNoteId != null) {
		return swos.openNote(viewNoteId, loginId);
	}
	return null;
}

/**
 * 通知タップ（action 空）時の既定遷移を解決する。
 *
 * @param data - push データ
 * @param loginId - ログイン ID
 * @returns 開いたウィンドウクライアント
 * @public
 */
export async function resolveNotificationTapDefault(
	data: NotificationPushData,
	loginId: string,
): Promise<WindowClient | null> {
	const type = getEffectiveNotificationType(
		data.body as NotificationClickMetaBody,
	);

	if (type === "receiveFollowRequest") {
		return swos.openClient("push", "/my/follow-requests", loginId);
	}
	if (type === "groupInvited") {
		return swos.openClient("push", "/my/groups", loginId);
	}
	if (type === "app" || isR4NotificationType(type) || isR5NotificationType(type)) {
		return openNotifications(loginId);
	}
	if ("note" in data.body && data.body.note != null) {
		return swos.openNote(data.body.note.id, loginId);
	}
	if ("user" in data.body && data.body.user != null) {
		return swos.openUser(getAcct(data.body.user), loginId);
	}
	return null;
}

/**
 * `view` action クリック時の遷移を解決する。
 *
 * @param data - push データ
 * @param loginId - ログイン ID
 * @returns 開いたウィンドウクライアント
 * @public
 */
export async function resolveNotificationViewAction(
	data: NotificationPushData,
	loginId: string,
): Promise<WindowClient | null> {
	const body = data.body as NotificationClickMetaBody;
	const type = getEffectiveNotificationType(body);

	// R5: 「表示」は必ずノート。noteId が無いときはプロフィールに落とさず一覧へ
	if (isR5NotificationType(type) || resolveR5ViewNoteId(body) != null) {
		const client = await openR5ViewNote(data, loginId);
		return client ?? openNotifications(loginId);
	}
	return resolveNotificationTapDefault(data, loginId);
}

/**
 * `profile` action クリック時にユーザプロフィールを開く。
 *
 * @param data - push データ
 * @param loginId - ログイン ID
 * @returns 開いたウィンドウクライアント
 * @public
 */
export async function resolveNotificationProfileAction(
	data: NotificationPushData,
	loginId: string,
): Promise<WindowClient | null> {
	if (!("user" in data.body) || data.body.user == null) {
		return null;
	}
	return swos.openUser(getAcct(data.body.user), loginId);
}
