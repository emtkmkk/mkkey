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

/** push で送信する通知種別 */
export type PushNotificationType =
	| "notification"
	| "unreadMessagingMessage"
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
	readNotifications: { notificationIds: string[] };
	readAllNotifications: undefined;
	readAllMessagingMessages: undefined;
	readAllMessagingMessagesOfARoom: { userId: string } | { groupId: string };
};
