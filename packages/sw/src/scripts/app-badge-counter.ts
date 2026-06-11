/**
 * @packageDocumentation
 *
 * PWA アプリバッジ用の「端末受信プッシュ件数」カウンタ（Service Worker 側）。
 *
 * @remarks
 * NOTE: クライアントと同じ IDB キーを使い、アカウント別に受信数を永続化する。
 * NOTE: 表示の最終計算（サーバー未読時の最低 1）はクライアントが行う。SW は未フォーカス時に受信数のみ反映する。
 *
 * @internal
 */
import { get, set } from "idb-keyval";

const RECEIVED_COUNT_KEY_PREFIX = "app-badge-received-count:";

/**
 * IDB キーを生成する。
 *
 * @param userId - アカウント ID
 * @internal
 */
export function appBadgeReceivedCountKey(userId: string): string {
	return `${RECEIVED_COUNT_KEY_PREFIX}${userId}`;
}

/**
 * 受信カウントを取得する。
 *
 * @param userId - アカウント ID
 * @internal
 */
export async function getAppBadgeReceivedCount(userId: string): Promise<number> {
	const value = await get(appBadgeReceivedCountKey(userId));
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return 0;
	}
	return Math.floor(value);
}

/**
 * 受信カウントを 1 増やす。
 *
 * @param userId - アカウント ID
 * @returns 増加後の値
 * @internal
 */
export async function incrementAppBadgeReceivedCount(
	userId: string,
): Promise<number> {
	const next = (await getAppBadgeReceivedCount(userId)) + 1;
	await set(appBadgeReceivedCountKey(userId), next);
	return next;
}

/**
 * 受信カウントを 0 に戻す。
 *
 * @param userId - アカウント ID
 * @internal
 */
export async function resetAppBadgeReceivedCount(userId: string): Promise<void> {
	await set(appBadgeReceivedCountKey(userId), 0);
}

type AppBadgeNavigator = Navigator & {
	clearAppBadge?: () => Promise<void>;
	setAppBadge?: (count: number) => Promise<void>;
};

/**
 * App Badging API で件数を反映する（SW 用・受信数のみ）。
 *
 * @param displayCount - 表示件数
 * @internal
 */
export function applyAppBadgeCountInSw(displayCount: number): void {
	const nav = self.navigator as AppBadgeNavigator;
	if (!("setAppBadge" in nav)) return;

	if (displayCount <= 0) {
		void nav.clearAppBadge?.();
		return;
	}

	void nav.setAppBadge?.(displayCount);
}
