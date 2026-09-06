/**
 * @packageDocumentation
 *
 * Web Push ペイロード型定義。
 *
 * @remarks
 * NOTE: read* 系は push では no-op（ストリーム同期に移行済み）。
 *
 * @internal
 */
import type { Packed } from "@/misc/schema.js";
import type { MessagingMessage } from "@/models/entities/messaging-message.js";

/**
 * 管理者からの一斉プッシュ告知。
 *
 * @remarks
 * - アプリ内通知（Notification 行・ストリーム）は一切作らない。**プッシュ専用**。
 * - 「オンライン時は通知を表示しない」設定を**意図的に無視する**。
 *   プッシュ通知自体の不調を知らせる用途があり、届かないと意味がないため。
 */
export type PushNoticePayload = {
	title: string;
	body: string;
	/** タップ時に開くパス（同一オリジンの相対パスを想定） */
	url?: string;
	/** 同じ告知を重複表示させないためのタグ */
	tag?: string;
};

/** push で送信する通知種別 */
export type PushNotificationType =
	| "notification"
	| "unreadMessagingMessage"
	| "pushNotice"
	| "readNotifications"
	| "readAllNotifications"
	| "readAllMessagingMessages"
	| "readAllMessagingMessagesOfARoom";

/** read* 系（push では no-op） */
export const PUSH_READ_SYNC_TYPES: readonly PushNotificationType[] = [
	"readNotifications",
	"readAllNotifications",
	"readAllMessagingMessages",
	"readAllMessagingMessagesOfARoom",
] as const;

export type pushNotificationsTypes = {
	notification: Packed<"Notification">;
	unreadMessagingMessage: Packed<"MessagingMessage">;
	pushNotice: PushNoticePayload;
	readNotifications: { notificationIds: string[] };
	readAllNotifications: undefined;
	readAllMessagingMessages: undefined;
	readAllMessagingMessagesOfARoom: { userId: string } | { groupId: string };
};
