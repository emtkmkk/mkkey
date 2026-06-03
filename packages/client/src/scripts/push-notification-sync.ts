/**
 * @packageDocumentation
 *
 * ストリーム既読イベントを Service Worker の通知 close にブリッジする。
 *
 * @internal
 */
/**
 * SW に通知クローズ指示を送る。
 *
 * @param order - 閉じ方
 * @internal
 */
export function postCloseNotificationsToSw(order: {
	kind:
		| "readAllNotifications"
		| "readNotifications"
		| "readAllMessagingMessages"
		| "readAllMessagingMessagesOfARoom";
	notificationIds?: string[];
	room?: { userId?: string; groupId?: string };
}): void {
	if (!navigator.serviceWorker?.controller) return;
	navigator.serviceWorker.controller.postMessage({
		type: "close-notifications",
		order,
	});
}

/**
 * SW に dev モードフラグを同期する。
 *
 * @param developer - registry developer 値
 * @internal
 */
export function postDeveloperModeToSw(developer: boolean): void {
	if (!navigator.serviceWorker?.controller) return;
	navigator.serviceWorker.controller.postMessage({
		type: "set-developer",
		value: developer,
	});
}

/**
 * SW にフォアグラウンド通知抑制フラグを同期する。
 *
 * @param suppress - 抑制するか
 * @internal
 */
export function postSuppressPushWhenForegroundToSw(suppress: boolean): void {
	if (!navigator.serviceWorker?.controller) return;
	navigator.serviceWorker.controller.postMessage({
		type: "set-suppress-push-when-foreground",
		value: suppress,
	});
}
