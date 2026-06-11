/**
 * @packageDocumentation
 *
 * PWA アプリバッジ用の「端末受信プッシュ件数」カウンタ（クライアント側）。
 *
 * @remarks
 * NOTE: Service Worker と同じ IDB キーを共有する。
 *
 * @internal
 */
import { get, set } from "@/scripts/idb-proxy";

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
 * 受信カウントを 0 に戻す。
 *
 * @param userId - アカウント ID
 * @internal
 */
export async function resetAppBadgeReceivedCount(userId: string): Promise<void> {
	await set(appBadgeReceivedCountKey(userId), 0);
}
