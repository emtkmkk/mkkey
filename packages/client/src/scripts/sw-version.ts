/**
 * @packageDocumentation
 *
 * Service Worker の版数取得と明示更新のヘルパ。
 *
 * @remarks
 * NOTE: `controller` 未接続時は `registration.active` へ postMessage する。
 *
 * @public
 */

/** SW 更新 API の結果 */
export type ServiceWorkerUpdateResult = "updated" | "no-change" | "no-sw";

/**
 * 応答可能な Service Worker クライアントを取得する。
 *
 * @returns active または controller。いなければ null
 * @internal
 */
async function getServiceWorkerClient(): Promise<ServiceWorker | null> {
	if (!("serviceWorker" in navigator)) return null;

	const reg = await navigator.serviceWorker.getRegistration();
	return reg?.active ?? navigator.serviceWorker.controller;
}

/**
 * 稼働中の Service Worker のビルド版数を取得する。
 *
 * @param timeoutMs - 応答待ちタイムアウト（ミリ秒）
 * @returns 版数文字列。取得失敗時は null
 * @public
 */
export async function fetchSwVersion(timeoutMs = 1500): Promise<string | null> {
	const sw = await getServiceWorkerClient();
	if (!sw) return null;

	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const timer = window.setTimeout(() => resolve(null), timeoutMs);

		channel.port1.onmessage = (event: MessageEvent<{ version?: string }>) => {
			window.clearTimeout(timer);
			const version = event.data?.version;
			resolve(typeof version === "string" && version !== "" ? version : null);
		};

		sw.postMessage({ type: "get-version" }, [channel.port2]);
	});
}

/**
 * Service Worker スクリプトの再フェッチを要求する。
 *
 * @remarks
 * NOTE: 本プロジェクトの SW は `skipWaiting` / `clients.claim` 済みのため、
 * 新版取得後は比較的早く active 化される。
 *
 * @returns 更新の有無
 * @public
 */
export async function updateServiceWorker(): Promise<ServiceWorkerUpdateResult> {
	if (!("serviceWorker" in navigator)) return "no-sw";

	const reg = await navigator.serviceWorker.getRegistration();
	if (!reg) return "no-sw";

	await reg.update();

	if (reg.installing != null || reg.waiting != null) {
		return "updated";
	}

	return "no-change";
}
