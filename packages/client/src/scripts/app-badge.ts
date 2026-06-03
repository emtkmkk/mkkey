/**
 * @packageDocumentation
 *
 * App Badging API（未読バッジ）の更新ヘルパー。
 *
 * @internal
 */
import { $i } from "@/account";

/**
 * 未読状態に応じてアプリバッジを更新する。
 *
 * @internal
 */
export function updateAppBadgeFromAccount(): void {
	if (!("setAppBadge" in navigator)) return;

	const count =
		($i?.hasUnreadNotification ? 1 : 0) +
		($i?.hasUnreadMessagingMessage ? 1 : 0) +
		($i?.hasUnreadMentions ? 1 : 0);

	if (count <= 0) {
		void (navigator as Navigator & { clearAppBadge?: () => Promise<void> })
			.clearAppBadge?.();
	} else {
		void (navigator as Navigator & { setAppBadge?: (n: number) => Promise<void> })
			.setAppBadge?.(count);
	}
}
