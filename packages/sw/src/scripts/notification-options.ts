/**
 * @packageDocumentation
 *
 * showNotification 用の共通オプション組み立て。
 *
 * @internal
 */
declare var self: ServiceWorkerGlobalScope;

const MAX_NOTIFICATION_ACTIONS = 2;

/**
 * 通知 actions を OS 上限に合わせて切り詰める。
 *
 * @param actions - 元の actions
 * @returns 最大2件の actions
 * @internal
 */
export function clipNotificationActions(
	actions: NotificationAction[] | undefined,
): NotificationAction[] | undefined {
	if (actions == null || actions.length <= MAX_NOTIFICATION_ACTIONS) {
		return actions;
	}
	return actions.slice(0, MAX_NOTIFICATION_ACTIONS);
}

/**
 * ノート添付のサムネイル URL を取得する（リッチ通知用）。
 *
 * @param note - 通知に含まれるノート
 * @returns image URL または undefined
 * @internal
 */
export function getNoteNotificationImage(
	note: { files?: Array<{ thumbnailUrl?: string | null }> } | null | undefined,
): string | undefined {
	const file = note?.files?.[0];
	if (file?.thumbnailUrl) return file.thumbnailUrl;
	return undefined;
}

/**
 * push ペイロードから共通 NotificationOptions を組み立てる。
 *
 * @param data - push データ
 * @param options - 種別固有オプション
 * @internal
 */
export function buildNotificationOptions(
	data: { dateTime: number },
	options: NotificationOptions,
): NotificationOptions {
	return {
		timestamp: data.dateTime,
		...options,
		actions: clipNotificationActions(options.actions),
	};
}
