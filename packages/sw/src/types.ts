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
/**
 * backend の push 送信時に付与される表示用フィールド。
 *
 * @remarks
 * services/push-notification.ts の attachDisplayTextToNotification が付ける。
 * 無ければ SW 側で種別ごとの文面にフォールバックする。
 */
type PushDisplayText = {
	displayTitle?: string | null;
	displayBody?: string | null;
};

type pushNotificationDataSourceMap = {
	notification: Misskey.entities.Notification & PushDisplayText;
	unreadMessagingMessage: Misskey.entities.MessagingMessage & PushDisplayText;
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

/**
 * 受信しうる全 push データの合併型。
 *
 * @remarks
 * `pushNotificationDataMap[K]` のようなジェネリックな indexed access のままだと
 * `switch (data.type)` で型が絞り込まれない。受け取り側はこの合併型を使うこと。
 *
 * @public
 */
export type pushNotificationDataUnion =
	pushNotificationDataMap[keyof pushNotificationDataMap];
