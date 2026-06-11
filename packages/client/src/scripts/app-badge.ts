/**
 * @packageDocumentation
 *
 * App Badging API（未読バッジ）の更新ヘルパー。
 *
 * @remarks
 * - 基本: 端末が受け取ったプッシュ件数（IDB）を表示する。
 * - 補正: 受信カウントが 0 でもサーバー未読フラグがあれば最低 1 を表示する。
 * - アプリを開いたとき（visible）は受信カウントを 0 にリセットする（init 側）。
 *
 * @internal
 */
import { $i } from "@/account";
import {
	getAppBadgeReceivedCount,
	resetAppBadgeReceivedCount,
} from "@/scripts/app-badge-counter";

type AppBadgeNavigator = Navigator & {
	clearAppBadge?: () => Promise<void>;
	setAppBadge?: (count: number) => Promise<void>;
};

type AppBadgeUnreadFlags = {
	hasUnreadNotification?: boolean;
	hasUnreadMessagingMessage?: boolean;
	hasUnreadMentions?: boolean;
};

/**
 * App Badging API が利用可能か。
 *
 * @internal
 */
export function isAppBadgeSupported(): boolean {
	return "setAppBadge" in navigator;
}

/**
 * アプリバッジをクリアする。
 *
 * @remarks
 * NOTE: ログアウト時など、表示を強制的に消す用途。
 * @internal
 */
export function clearAppBadge(): void {
	if (!isAppBadgeSupported()) return;
	void (navigator as AppBadgeNavigator).clearAppBadge?.();
}

/**
 * 受信カウントとサーバー未読フラグからバッジ表示件数を算出する。
 *
 * @param localReceivedCount - 端末受信プッシュの累計（アプリを開くたびに 0 へリセット）
 * @param account - 未読フラグ（`$i` の一部）
 * @returns バッジに出す件数
 * @internal
 */
export function computeAppBadgeDisplayCount(
	localReceivedCount: number,
	account: AppBadgeUnreadFlags | null | undefined,
): number {
	const local = Math.max(0, Math.floor(localReceivedCount));
	if (local > 0) return local;
	if (account == null) return 0;

	const hasServerUnread =
		!!account.hasUnreadNotification ||
		!!account.hasUnreadMessagingMessage ||
		!!account.hasUnreadMentions;

	return hasServerUnread ? 1 : 0;
}

/**
 * OS バッジを現在の受信カウントとサーバー未読フラグに合わせて更新する。
 *
 * @internal
 */
export async function refreshAppBadge(): Promise<void> {
	if (!isAppBadgeSupported()) return;

	if ($i == null) {
		clearAppBadge();
		return;
	}

	const localReceivedCount = await getAppBadgeReceivedCount($i.id);
	const displayCount = computeAppBadgeDisplayCount(localReceivedCount, $i);

	if (displayCount <= 0) {
		clearAppBadge();
		return;
	}

	void (navigator as AppBadgeNavigator).setAppBadge?.(displayCount);
}

/**
 * 受信カウントを 0 に戻し、バッジを再計算する。
 *
 * @remarks
 * NOTE: アプリを前面にしたタイミングで呼ぶ。
 * @internal
 */
export async function resetAppBadgeReceivedCountAndRefresh(): Promise<void> {
	if ($i == null) {
		clearAppBadge();
		return;
	}

	await resetAppBadgeReceivedCount($i.id);
	await refreshAppBadge();
}

/**
 * 未読フラグの変化に合わせてバッジを更新する（受信カウントは変更しない）。
 *
 * @remarks
 * CHANGED: サーバーフラグの 0/1 合算から、受信カウント + 最低 1 補正へ変更。
 * @internal
 */
export function updateAppBadgeFromAccount(): void {
	void refreshAppBadge();
}

/**
 * アプリを開いたときの受信カウントリセットとバッジ同期を登録する。
 *
 * @internal
 */
export function setupAppBadgeOnAppOpen(): void {
	const onVisible = () => {
		if (document.visibilityState !== "visible") return;
		void resetAppBadgeReceivedCountAndRefresh();
	};

	if (document.visibilityState === "visible") {
		void resetAppBadgeReceivedCountAndRefresh();
	}

	document.addEventListener("visibilitychange", onVisible);
}
