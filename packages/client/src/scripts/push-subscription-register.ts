/**
 * @packageDocumentation
 *
 * ブラウザの PushSubscription をサーバーへ登録する共通ヘルパー。
 *
 * @remarks
 * - pushsubscriptionchange 時はグローバルハンドラから再登録する（ユーザが明示オフしていない場合のみ）。
 *
 * @internal
 */
import { $i } from "@/account";
import { instance } from "@/instance";
import { api } from "@/os";
import { isPushServerOptOut } from "@/scripts/push-opt-out";

/**
 * ArrayBuffer を base64 文字列にエンコードする。
 *
 * @param buffer - 鍵バッファ
 * @returns base64 文字列
 * @internal
 */
export function encodePushKey(buffer: ArrayBuffer | null): string {
	if (buffer == null) return "";
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * VAPID 公開鍵（base64url）を Uint8Array に変換する。
 *
 * @param base64String - applicationServerKey
 * @internal
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding)
		.replace(/-/g, "+")
		.replace(/_/g, "/");

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * 購読情報をサーバーへ登録する。
 *
 * @param subscription - ブラウザの PushSubscription
 * @param cause - 登録理由（dev ログ用）
 * @internal
 */
export async function registerPushSubscription(
	subscription: PushSubscription,
	cause: "api-call" | "pushsubscriptionchange" = "api-call",
) {
	if (!$i?.token) return null;

	return await api("sw/register", {
		endpoint: subscription.endpoint,
		auth: encodePushKey(subscription.getKey("auth")),
		publickey: encodePushKey(subscription.getKey("p256dh")),
		cause,
	});
}

/** `sw/show-registration` の応答 */
type PushRegistrationInServer = {
	userId: string;
	endpoint: string;
	sendReadMessage: boolean;
} | null;

/**
 * サーバー側の購読登録を照会する。
 *
 * @remarks
 * NOTE: calckey-js の `Endpoints` に `sw/show-registration` の定義が無いため、
 * ここで型を与えて呼び出す。
 *
 * @internal
 */
async function showRegistration(params: {
	endpoint: string;
	auth: string;
	publickey: string;
}): Promise<PushRegistrationInServer> {
	const call = api as unknown as (
		endpoint: string,
		data: Record<string, unknown>,
	) => Promise<PushRegistrationInServer>;
	return await call("sw/show-registration", params);
}

/**
 * 起動時にブラウザ購読とサーバー登録の食い違いを解消する。
 *
 * @remarks
 * - **なぜ必要か**: 410 削除・DB 側の消失・`pushsubscriptionchange` の取りこぼしなどで
 *   サーバー登録だけが消えると、ブラウザ側の購読は健全なままなので何のイベントも飛ばない。
 *   従来は設定画面を開いて手動で「購読」を押すまで永久に復旧しなかった。
 * - ユーザが明示的にオフにした場合（{@link isPushServerOptOut}）は何もしない。
 * - 新規に購読を作ることはしない。既にある購読の登録漏れだけを直す。
 *
 * @internal
 */
export async function reconcilePushSubscriptionOnBoot(): Promise<void> {
	if (!$i?.token || !instance.swPublickey) return;
	if (isPushServerOptOut($i.id)) return;
	if (!("serviceWorker" in navigator)) return;

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		// 購読が無い場合は勝手に作らない（通知許可を求めることになるため）
		if (subscription == null) return;

		const auth = encodePushKey(subscription.getKey("auth"));
		const publickey = encodePushKey(subscription.getKey("p256dh"));

		const existing = await showRegistration({
			endpoint: subscription.endpoint,
			auth,
			publickey,
		});
		if (existing != null) return;

		await registerPushSubscription(subscription, "api-call");
		console.info("[mkkey-push] サーバー登録が失われていたため再登録しました");
	} catch (err) {
		console.warn("[mkkey-push] 起動時の購読照合に失敗しました", err);
	}
}

/**
 * pushsubscriptionchange 後に購読を再登録する（グローバル用）。
 *
 * @remarks
 * NOTE: {@link isPushServerOptOut} が true のときは再登録しない。
 *
 * @internal
 */
export async function reregisterPushSubscriptionAfterChange(): Promise<void> {
	if (!$i?.token || !instance.swPublickey) return;
	if (isPushServerOptOut($i.id)) return;
	if (!("serviceWorker" in navigator)) return;

	try {
		const registration = await navigator.serviceWorker.ready;
		let subscription = await registration.pushManager.getSubscription();

		if (subscription == null) {
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(instance.swPublickey),
			});
		}

		await registerPushSubscription(subscription, "pushsubscriptionchange");
	} catch (err) {
		console.warn("[mkkey-push] pushsubscriptionchange の再登録に失敗しました", err);
	}
}
