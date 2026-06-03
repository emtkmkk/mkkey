/**
 * @packageDocumentation
 *
 * Service Worker 上で表示中の通知を閉じるヘルパー。
 *
 * @internal
 */
declare var self: ServiceWorkerGlobalScope;

/**
 * 通知種別・ID に応じて OS 通知を閉じる。
 *
 * @param order - 閉じ方の指示
 * @internal
 */
export async function closePushNotifications(order: {
	kind:
		| "readAllNotifications"
		| "readNotifications"
		| "readAllMessagingMessages"
		| "readAllMessagingMessagesOfARoom";
	notificationIds?: string[];
	room?: { userId?: string; groupId?: string };
}): Promise<void> {
	const notifications = await self.registration.getNotifications();

	switch (order.kind) {
		case "readAllNotifications":
			for (const n of notifications) {
				if (n?.data?.type === "notification") n.close();
			}
			break;
		case "readNotifications":
			for (const n of notifications) {
				const id = n?.data?.body?.id;
				if (id && order.notificationIds?.includes(id)) {
					n.close();
				}
			}
			break;
		case "readAllMessagingMessages":
			for (const n of notifications) {
				if (n?.data?.type === "unreadMessagingMessage") n.close();
			}
			break;
		case "readAllMessagingMessagesOfARoom":
			for (const n of notifications) {
				if (n.data?.type !== "unreadMessagingMessage") continue;
				const body = n.data.body;
				if (
					order.room?.userId != null &&
					body?.userId === order.room.userId
				) {
					n.close();
				} else if (
					order.room?.groupId != null &&
					body?.groupId === order.room.groupId
				) {
					n.close();
				}
			}
			break;
	}
}

/**
 * フォアグラウンド（表示中かつフォーカス）のクライアントが存在するか。
 *
 * @internal
 */
export async function hasFocusedVisibleClient(): Promise<boolean> {
	const clients = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	return clients.some(
		(c) => c.visibilityState === "visible" && "focused" in c && c.focused,
	);
}
