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

/**
 * RT 先ノート ID をペイロードから取得する。
 *
 * @param body - 通知 body
 * @returns RT 先 noteId（無いとき undefined）
 * @internal
 */
function getRenoteTargetNoteId(
	body: NotificationPushData["body"],
): string | undefined {
	const extended = body as NotificationPushData["body"] & {
		renoteTargetNoteId?: string;
	};
	if (typeof extended.renoteTargetNoteId === "string") {
		return extended.renoteTargetNoteId;
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
	if (!("note" in data.body) || data.body.note == null) {
		return null;
	}
	if (data.body.type === "renote") {
		const renoteTargetNoteId = getRenoteTargetNoteId(data.body);
		if (renoteTargetNoteId != null) {
			return swos.openNote(renoteTargetNoteId, loginId);
		}
	}
	if (typeof data.body.note.id === "string") {
		return swos.openNote(data.body.note.id, loginId);
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
	const { type } = data.body;

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
	if (isR5NotificationType(data.body.type)) {
		return openR5ViewNote(data, loginId);
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
