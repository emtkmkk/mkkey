/**
 * @packageDocumentation
 *
 * ブラウザの PushSubscription をサーバーへ登録する共通ヘルパー。
 *
 * @remarks
 * NOTE: pushsubscriptionchange 時はグローバルハンドラからも呼ぶ。
 *
 * @internal
 */
import { $i } from "@/account";
import { instance } from "@/instance";
import { api } from "@/os";

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

/**
 * pushsubscriptionchange 後に購読を再登録する（グローバル用）。
 *
 * @internal
 */
export async function reregisterPushSubscriptionAfterChange(): Promise<void> {
	if (!$i?.token || !instance.swPublickey) return;
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
