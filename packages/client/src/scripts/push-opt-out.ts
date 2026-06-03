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

const storageKey = (userId: string): string => `pushOptOut:${userId}`;

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
