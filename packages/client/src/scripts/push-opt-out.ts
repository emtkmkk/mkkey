/**
 * @packageDocumentation
 *
 * プッシュ通知のサーバー登録をユーザが明示的にオフにした意図を端末に保持する。
 *
 * @remarks
 * - ブラウザの PushSubscription は端末共有のため、サーバー解除後も残りうる。
 * - このフラグがある間は自動の sw/register（sync や pushsubscriptionchange）を抑止する。
 *
 * @internal
 */

import { get as idbGet, set as idbSet } from "idb-keyval";

const storageKey = (userId: string): string => `pushOptOut:${userId}`;

/**
 * Service Worker が読むミラー用の IDB キー。
 *
 * @remarks
 * localStorage は SW から読めないため、オプトアウト意図をここへ複製する。
 * `sw/src/scripts/push-opt-out.ts` と値を一致させること。
 */
const PUSH_OPT_OUT_IDB_KEY = "pushOptOutUserIds";

/**
 * オプトアウト状態を IDB へ複製する（SW からの自動再登録を抑止するため）。
 *
 * @internal
 */
async function mirrorPushOptOutToIdb(
	userId: string,
	optOut: boolean,
): Promise<void> {
	try {
		const stored = await idbGet(PUSH_OPT_OUT_IDB_KEY);
		const ids = new Set<string>(Array.isArray(stored) ? stored : []);
		if (optOut) {
			ids.add(userId);
		} else {
			ids.delete(userId);
		}
		await idbSet(PUSH_OPT_OUT_IDB_KEY, [...ids]);
	} catch {
		// IDB が使えない環境では SW もアカウントを読めないため再登録は走らない
	}
}

/**
 * 現アカウントでサーバーへのプッシュ登録を望まないことを記録する。
 *
 * @param userId - ローカルユーザー ID
 * @param optOut - true でオフ意図を保存、false でクリア
 * @internal
 */
export function setPushServerOptOut(userId: string, optOut: boolean): void {
	const key = storageKey(userId);
	if (optOut) {
		localStorage.setItem(key, "1");
	} else {
		localStorage.removeItem(key);
	}
	void mirrorPushOptOutToIdb(userId, optOut);
}

/**
 * ユーザが明示的にプッシュ登録を解除したか。
 *
 * @param userId - ローカルユーザー ID
 * @returns オフ意図が保存されていれば true
 * @internal
 */
export function isPushServerOptOut(userId: string): boolean {
	return localStorage.getItem(storageKey(userId)) === "1";
}

const wantedStorageKey = (userId: string): string => `pushWanted:${userId}`;

/**
 * このアカウントで、端末がプッシュ通知を使っていたことを記録する。
 *
 * @remarks
 * - ブラウザの購読が外部要因（SW の登録解除、ブラウザによる破棄など）で消えたとき、
 *   起動時に作り直してよいかの判断材料にする。
 * - 通知の許可状態だけでは判断できない。`init.ts` が起動時に許可を求めるため、
 *   「許可済み」でもプッシュを使っていたとは限らない。
 * - 明示的な解除は {@link setPushServerOptOut} が優先される。
 *
 * @param userId - ローカルユーザー ID
 * @param wanted - true で記録、false で消去
 * @internal
 */
export function setPushWanted(userId: string, wanted: boolean): void {
	const key = wantedStorageKey(userId);
	if (wanted) {
		localStorage.setItem(key, "1");
	} else {
		localStorage.removeItem(key);
	}
}

/**
 * この端末でこのアカウントがプッシュ通知を使っていたか。
 *
 * @param userId - ローカルユーザー ID
 * @internal
 */
export function isPushWanted(userId: string): boolean {
	return localStorage.getItem(wantedStorageKey(userId)) === "1";
}
