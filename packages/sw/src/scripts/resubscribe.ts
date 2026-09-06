/**
 * @packageDocumentation
 *
 * `pushsubscriptionchange` を Service Worker 内で完結させる。
 *
 * @remarks
 * - **なぜ必要か**: 従来はウィンドウへ postMessage するだけだったため、
 *   タブが 1 枚も開いていないときに再登録が失われていた。
 *   このイベントはブラウザが裏で購読をローテーションしたときに飛ぶので、
 *   むしろタブが無い状態が本命のケースだった。
 * - `sw/register` は endpoint 単位の upsert なので、ウィンドウ側と
 *   二重に実行されても安全。
 * - 明示的にオプトアウトしたアカウントは再登録しない。
 *
 * @internal
 */
declare var self: ServiceWorkerGlobalScope;

import { get } from "idb-keyval";
import { cli } from "@/scripts/operations";
import { isPushServerOptOutInSw } from "@/scripts/push-opt-out";

type StoredAccount = { token: string; id: string };

function encodePushKey(buffer: ArrayBuffer | null): string {
	if (buffer == null) return "";
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * 購読を取り直し、保存済みの全アカウントについてサーバーへ再登録する。
 *
 * @returns 1 件でも登録できたとき true
 * @internal
 */
export async function resubscribeAndRegisterInSw(): Promise<boolean> {
	let accounts: StoredAccount[];
	try {
		const stored = await get("accounts");
		if (!Array.isArray(stored) || stored.length === 0) return false;
		accounts = stored as StoredAccount[];
	} catch {
		return false;
	}

	// applicationServerKey はクライアントの instance ストアに無いので meta から取る
	let publicKey: string;
	try {
		const meta = (await cli.request("meta", { detail: false })) as {
			swPublickey?: string;
		};
		if (typeof meta.swPublickey !== "string" || meta.swPublickey === "") {
			return false;
		}
		publicKey = meta.swPublickey;
	} catch {
		return false;
	}

	let subscription = await self.registration.pushManager.getSubscription();
	if (subscription == null) {
		subscription = await self.registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey),
		});
	}

	const auth = encodePushKey(subscription.getKey("auth"));
	const publickey = encodePushKey(subscription.getKey("p256dh"));

	let registered = false;
	for (const account of accounts) {
		if (account?.id == null || account?.token == null) continue;
		if (await isPushServerOptOutInSw(account.id)) continue;

		try {
			await cli.request(
				"sw/register",
				{
					endpoint: subscription.endpoint,
					auth,
					publickey,
					cause: "pushsubscriptionchange",
				},
				account.token,
			);
			registered = true;
		} catch (err) {
			// 失敗は握り潰さない。ここが通らないと購読が復旧しない
			console.warn("[mkkey-push] SW からの再登録に失敗しました", err);
		}
	}

	return registered;
}
