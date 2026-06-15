declare var self: ServiceWorkerGlobalScope;

import { createNotification } from "@/scripts/create-notification";
import {
	closePushNotifications,
	hasFocusedVisibleClient,
} from "@/scripts/close-push-notifications";
import { FETCH_TIMEOUT_MS } from "@/const";
import { swLang } from "@/scripts/lang";
import { swNotificationRead } from "@/scripts/notification-read";
import type { pushNotificationDataMap } from "@/types";
import * as swos from "@/scripts/operations";
import {
	resolveNotificationProfileAction,
	resolveNotificationTapDefault,
	resolveNotificationViewAction,
} from "@/scripts/notification-click";
import { set } from "idb-keyval";
import {
	incrementAppBadgeReceivedCount,
	applyAppBadgeCountInSw,
} from "@/scripts/app-badge-counter";
import {
	loadSuppressPushWhenForeground,
	saveSuppressPushWhenForeground,
} from "@/scripts/push-foreground-prefs";

/** クライアントから同期される dev モード（registry developer） */
let swDeveloperMode = false;

/** IDB 未同期時のフォアグラウンド抑制フォールバック（既定 ON） */
let swSuppressPushWhenForegroundFallback = true;

self.addEventListener("install", (ev) => {
	ev.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (ev) => {
	ev.waitUntil(
		caches
			.keys()
			.then((cacheNames) =>
				Promise.all(
					cacheNames
						.filter((v) => v !== swLang.cacheName)
						.map((name) => caches.delete(name)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

async function respondToNavigation(request: Request): Promise<Response> {
	const controller = new AbortController();
	const timeout = self.setTimeout(() => {
		controller.abort("navigation-timeout");
	}, FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(request, { signal: controller.signal });

		if (response?.status && response.status < 500) return response;
		if (response?.type === "opaqueredirect") return response;
	} catch (error) {
		if (_DEV_) {
			console.warn("navigation fetch failed; showing offline page", error);
		}
	} finally {
		self.clearTimeout(timeout);
	}

	const html = await offlineContentHTML();
	return new Response(html, {
		status: 200,
		headers: {
			"content-type": "text/html",
		},
	});
}

async function offlineContentHTML() {
	let i18n;
	try {
		i18n = await (swLang.i18n ?? swLang.fetchLocale());
	} catch {
		i18n = {};
	}
	const messages = {
		title:
			i18n.ts?._offlineScreen?.title ?? "Offline - Could not connect to server",
		header: i18n.ts?._offlineScreen?.header ?? "Could not connect to server",
		reload: i18n.ts?.reload ?? "Reload",
	};

	return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta content="width=device-width,initial-scale=1"name="viewport"><title>${messages.title}</title><style>body{background-color:#0c1210;color:#dee7e4;font-family:Hiragino Maru Gothic Pro,BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif;line-height:1.35;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}.icon{max-width:120px;width:100%;height:auto;margin-bottom:20px;}.message{text-align:center;font-size:20px;font-weight:700;margin-bottom:20px}.version{text-align:center;font-size:90%;margin-bottom:20px}button{padding:7px 14px;min-width:100px;font-weight:700;font-family:Hiragino Maru Gothic Pro,BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif;line-height:1.35;border-radius:99rem;background-color:#b4e900;color:#192320;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent}button:hover{background-color:#c6ff03}</style></head><body><svg class="icon"fill="none"height="24"stroke="currentColor"stroke-linecap="round"stroke-linejoin="round"stroke-width="2"viewBox="0 0 24 24"width="24"xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"fill="none"stroke="none"/><path d="M9.58 5.548c.24 -.11 .492 -.207 .752 -.286c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 .957 -.383 1.824 -1.003 2.454m-2.997 1.033h-11.343c-2.572 -.004 -4.657 -2.011 -4.657 -4.487c0 -2.475 2.085 -4.482 4.657 -4.482c.13 -.582 .37 -1.128 .7 -1.62"/><path d="M3 3l18 18"/></svg><div class="message">${messages.header}</div><div class="version">v${_VERSION_}</div><button onclick="reloadPage()">${messages.reload}</button><script>function reloadPage(){location.reload(!0)}</script></body></html>`;
}



const SHARE_TARGET_PATHS = new Set(["/share", "/share/"]);
const SHARE_FILES_KEY_PREFIX = "sw-share-target-files:";

function buildShareQuery(formData: FormData): URLSearchParams {
	const query = new URLSearchParams();

	for (const key of ["title", "text", "url"] as const) {
		const value = formData.get(key);
		if (typeof value === "string" && value.length > 0) {
			query.set(key, value);
		}
	}

	return query;
}

async function handleShareTarget(request: Request): Promise<Response> {
	const formData = await request.formData();
	const query = buildShareQuery(formData);
	const files = formData
		.getAll("files")
		.filter((entry): entry is File => entry instanceof File && entry.size > 0);

	if (files.length > 0) {
		const sharedFilesKey = `${SHARE_FILES_KEY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
		await set(sharedFilesKey, {
			createdAt: Date.now(),
			files,
		});
		query.set("sharedFilesKey", sharedFilesKey);
	}

	const sharePath = query.toString().length > 0 ? `/share/?${query.toString()}` : "/share/";

	return Response.redirect(new URL(sharePath, origin).toString(), 303);
}

const APP_ROUTE_PREFIXES = [
	"/notes/",
	"/posts/",
	"/users/",
	"/channels/",
	"/clips/",
	"/gallery/",
	"/light",
	"/@",
] as const;

const APP_ROUTE_EXACT = new Set([
	"/",
	"/bios",
	"/cli",
	"/flush",
	"/sc",
]);

function isAppRoute(pathname: string): boolean {
	if (APP_ROUTE_EXACT.has(pathname)) return true;

	return APP_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener("fetch", (ev) => {
	const requestUrl = new URL(ev.request.url);

	if (SHARE_TARGET_PATHS.has(requestUrl.pathname) && ev.request.method === "POST") {
		ev.respondWith(handleShareTarget(ev.request));
		return;
	}

	let isHTMLRequest = false;
	if (ev.request.headers.get("sec-fetch-dest") === "document") {
		isHTMLRequest = true;
	} else if (ev.request.headers.get("accept")?.includes("/html")) {
		isHTMLRequest = true;
	} else if (ev.request.url.endsWith("/")) {
		isHTMLRequest = true;
	}

	if (!isHTMLRequest || !isAppRoute(requestUrl.pathname)) return;

	// 新規 UI ルートを backend 側に追加した際は isAppRoute も必ず更新すること。
	ev.respondWith(respondToNavigation(ev.request));
});

self.addEventListener("push", (ev) => {
	ev.waitUntil(
		(async () => {
			let data: pushNotificationDataMap[keyof pushNotificationDataMap] | null =
				null;
			try {
				data = ev.data?.json() ?? null;
			} catch (err) {
				if (_DEV_ || swDeveloperMode) {
					console.warn("[mkkey-push] invalid push payload", err);
				}
				return;
			}

			if (data == null || typeof data.type !== "string") {
				if (_DEV_ || swDeveloperMode) {
					console.warn("[mkkey-push] missing data.type");
				}
				return;
			}

			if (_DEV_ || swDeveloperMode) {
				console.info("[mkkey-push] received", data.type, data);
			}

			switch (data.type) {
				case "notification":
				case "unreadMessagingMessage": {
					if (Date.now() - data.dateTime > 1000 * 60 * 60 * 24) {
						return;
					}

					// 端末受信プッシュ件数（OS 表示の有無に関わらず加算）
					const receivedCount = await incrementAppBadgeReceivedCount(
						data.userId,
					);
					const focusedVisibleClient = await hasFocusedVisibleClient();

					if (focusedVisibleClient) {
						// 受信カウントの再計算はクライアント側（サーバー未読の最低 1 補正を含む）
						const clients = await self.clients.matchAll({
							type: "window",
							includeUncontrolled: true,
						});
						for (const client of clients) {
							client.postMessage({ type: "app-badge-refresh" });
						}
					}

					// フォアグラウンドでは OS 通知を出さずクライアントへ転送（アカウント別設定）
					const suppressForeground = await loadSuppressPushWhenForeground(
						data.userId,
						swSuppressPushWhenForegroundFallback,
					);
					if (
						suppressForeground &&
						focusedVisibleClient
					) {
						const clients = await self.clients.matchAll({
							type: "window",
							includeUncontrolled: true,
						});
						for (const client of clients) {
							if (
								client.visibilityState === "visible" &&
								"focused" in client &&
								client.focused
							) {
								client.postMessage({
									type: "in-app-notification",
									data,
								});
							}
						}
						return;
					}

					if (!focusedVisibleClient) {
						// クライアント未起動時は受信数のみ反映（最低 1 補正は起動後にクライアントが行う）
						applyAppBadgeCountInSw(receivedCount);
					}

					return createNotification(data);
				}
				default:
					if (_DEV_ || swDeveloperMode) {
						console.info("[mkkey-push] ignored type", data.type);
					}
					return;
			}
		})(),
	);
});

self.addEventListener("pushsubscriptionchange", (ev) => {
	ev.waitUntil(
		(async () => {
			if (_DEV_ || swDeveloperMode) {
				console.info("[mkkey-push] pushsubscriptionchange");
			}
			const clients = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			for (const client of clients) {
				client.postMessage({ type: "pushsubscriptionchange" });
			}
		})(),
	);
});

self.addEventListener(
	"notificationclick",
	<K extends keyof pushNotificationDataMap>(
		ev: ServiceWorkerGlobalScopeEventMap["notificationclick"],
	) => {
		ev.waitUntil(
			(async () => {
				if (_DEV_) {
					console.log("notificationclick", ev.action, ev.notification.data);
				}

				const { action, notification } = ev;
				const data: pushNotificationDataMap[K] = notification.data;
				const { userId: id } = data;
				let client: WindowClient | null = null;

				switch (data.type) {
					case "notification":
						switch (action) {
							case "view":
								client = await resolveNotificationViewAction(data, id);
								break;
							case "profile":
								client = await resolveNotificationProfileAction(data, id);
								break;
							case "reply":
								if ("note" in data.body)
									client = await swos.openPost(
										{ reply: data.body.note },
										id,
									);
								break;
							case "accept":
								if (data.body.type === "groupInvited") {
									await swos.api("users/groups/invitations/accept", id, {
										invitationId: data.body.invitation.id,
									});
								}
								break;
							case "reject":
								if (data.body.type === "groupInvited") {
									await swos.api("users/groups/invitations/reject", id, {
										invitationId: data.body.invitation.id,
									});
								}
								break;
							default:
								client = await resolveNotificationTapDefault(data, id);
								break;
						}
						break;
					case "unreadMessagingMessage":
						if (action === "view" || action === "") {
							client = await swos.openChat(data.body, id);
						}
						break;
				}

				if (client) {
					client.focus();
				}
				if (data.type === "notification") {
					swNotificationRead.then((that) => that.read(data));
				}

				notification.close();
			})(),
		);
	},
);

self.addEventListener(
	"notificationclose",
	<K extends keyof pushNotificationDataMap>(
		ev: ServiceWorkerGlobalScopeEventMap["notificationclose"],
	) => {
		const data: pushNotificationDataMap[K] = ev.notification.data;

		if (data.type === "notification") {
			swNotificationRead.then((that) => that.read(data));
		}
	},
);

self.addEventListener(
	"message",
	(ev: ServiceWorkerGlobalScopeEventMap["message"]) => {
		ev.waitUntil(
			(async () => {
				switch (ev.data) {
					case "clear":
						// Cache Storage全削除
						await caches
							.keys()
							.then((cacheNames) =>
								Promise.all(cacheNames.map((name) => caches.delete(name))),
							);
						return; // TODO
				}

				if (typeof ev.data === "object" && ev.data != null) {
					if (ev.data.type === "set-developer") {
						swDeveloperMode = !!ev.data.value;
						return;
					}

					if (ev.data.type === "set-suppress-push-when-foreground") {
						const suppress = !!ev.data.value;
						swSuppressPushWhenForegroundFallback = suppress;
						if (typeof ev.data.userId === "string" && ev.data.userId !== "") {
							await saveSuppressPushWhenForeground(
								ev.data.userId,
								suppress,
							);
						}
						return;
					}

					if (ev.data.type === "close-notifications") {
						await closePushNotifications(ev.data.order);
						return;
					}

					// クライアントから SW ビルド版数を問い合わせる
					if (ev.data.type === "get-version") {
						ev.ports[0]?.postMessage({ version: _VERSION_ });
						return;
					}

					const otype = Object.prototype.toString
						.call(ev.data)
						.slice(8, -1)
						.toLowerCase();

					if (otype === "object" && ev.data.msg === "initialize") {
						swLang.setLang(ev.data.lang);
						if (ev.data.developer != null) {
							swDeveloperMode = !!ev.data.developer;
						}
						if (ev.data.suppressPushWhenForeground != null) {
							const suppress = !!ev.data.suppressPushWhenForeground;
							swSuppressPushWhenForegroundFallback = suppress;
							if (
								typeof ev.data.userId === "string" &&
								ev.data.userId !== ""
							) {
								await saveSuppressPushWhenForeground(
									ev.data.userId,
									suppress,
								);
							}
						}
					}
				}
			})(),
		);
	},
);
