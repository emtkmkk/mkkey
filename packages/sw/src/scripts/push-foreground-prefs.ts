/**
 * @packageDocumentation
 *
 * フォアグラウンド時のプッシュ抑制設定（アカウント別・IDB 永続化）。
 *
 * @remarks
 * - クライアントの `suppressPushWhenForeground`（account スコープ）を SW が push 受信時に参照する。
 * - postMessage が controller 未接続で失われても、IDB から復元できる。
 *
 * @internal
 */
import { get, set } from "idb-keyval";

/** フォアグラウンド抑制の IDB キー */
export function suppressPushWhenForegroundIdbKey(userId: string): string {
	return `pushSuppressWhenForeground:${userId}`;
}

/**
 * 指定ユーザのフォアグラウンド抑制フラグを保存する。
 *
 * @param userId - 通知先ユーザ ID
 * @param suppress - 抑制するか
 * @internal
 */
export async function saveSuppressPushWhenForeground(
	userId: string,
	suppress: boolean,
): Promise<void> {
	await set(suppressPushWhenForegroundIdbKey(userId), suppress);
}

/**
 * 指定ユーザのフォアグラウンド抑制フラグを取得する。
 *
 * @param userId - 通知先ユーザ ID（push ペイロードの userId）
 * @param fallback - IDB 未設定時の既定（レガシー同期用）
 * @returns 抑制するなら true
 * @internal
 */
export async function loadSuppressPushWhenForeground(
	userId: string | undefined,
	fallback: boolean,
): Promise<boolean> {
	if (userId == null || userId === "") {
		return fallback;
	}
	const stored = await get(suppressPushWhenForegroundIdbKey(userId));
	if (typeof stored === "boolean") {
		return stored;
	}
	return fallback;
}
