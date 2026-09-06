import * as Misskey from "calckey-js";

export type swMessageOrderType = "post" | "push";

export type SwMessage = {
	type: "order";
	order: swMessageOrderType;
	loginId: string;
	url: string;
	[x: string]: any;
};

/** @see {@link ../../../backend/src/misc/push-notification-types.ts} backend 側と同期すること */
type pushNotificationDataSourceMap = {
	notification: Misskey.entities.Notification;
	unreadMessagingMessage: Misskey.entities.MessagingMessage;
	/**
	 * 管理者からの一斉プッシュ告知。
	 *
	 * @remarks
	 * プッシュ専用（アプリ内通知は作られない）。
	 * フォアグラウンド抑制設定を無視して必ず OS 通知を表示する。
	 */
	pushNotice: {
		title: string;
		body: string;
		url?: string;
		tag?: string;
	};
	readNotifications: { notificationIds: string[] };
	readAllNotifications: undefined;
	readAllMessagingMessages: undefined;
	readAllMessagingMessagesOfARoom: { userId: string } | { groupId: string };
};

export type pushNotificationData<
	K extends keyof pushNotificationDataSourceMap,
> = {
	type: K;
	body: pushNotificationDataSourceMap[K];
	userId: string;
	dateTime: number;
};

export type pushNotificationDataMap = {
	[K in keyof pushNotificationDataSourceMap]: pushNotificationData<K>;
};
