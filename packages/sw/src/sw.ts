declare var self: ServiceWorkerGlobalScope;

import {
	createEmptyNotification,
	createNotification,
} from "@/scripts/create-notification";
import { swLang } from "@/scripts/lang";
import { swNotificationRead } from "@/scripts/notification-read";
import { pushNotificationDataMap } from "@/types";
import * as swos from "@/scripts/operations";
import { acct as getAcct } from "@/filters/user";

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

async function offlineContentHTML() {
	const i18n = await (swLang.i18n ?? swLang.fetchLocale());
	const messages = {
		title: i18n.ts?._offlineScreen?.title ?? 'Offline - Could not connect to server',
		header: i18n.ts?._offlineScreen?.header ?? 'Could not connect to server',
		reload: i18n.ts?.reload ?? 'Reload',
	};

	return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta content="width=device-width,initial-scale=1"name="viewport"><title>${messages.title}</title><style>body{background-color:#0c1210;color:#dee7e4;font-family:Hiragino Maru Gothic Pro,BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif;line-height:1.35;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}.icon{max-width:120px;width:100%;height:auto;margin-bottom:20px;}.message{text-align:center;font-size:20px;font-weight:700;margin-bottom:20px}.version{text-align:center;font-size:90%;margin-bottom:20px}button{padding:7px 14px;min-width:100px;font-weight:700;font-family:Hiragino Maru Gothic Pro,BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif;line-height:1.35;border-radius:99rem;background-color:#b4e900;color:#192320;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent}button:hover{background-color:#c6ff03}</style></head><body><svg class="icon"fill="none"height="24"stroke="currentColor"stroke-linecap="round"stroke-linejoin="round"stroke-width="2"viewBox="0 0 24 24"width="24"xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"fill="none"stroke="none"/><path d="M9.58 5.548c.24 -.11 .492 -.207 .752 -.286c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 .957 -.383 1.824 -1.003 2.454m-2.997 1.033h-11.343c-2.572 -.004 -4.657 -2.011 -4.657 -4.487c0 -2.475 2.085 -4.482 4.657 -4.482c.13 -.582 .37 -1.128 .7 -1.62"/><path d="M3 3l18 18"/></svg><div class="message">${messages.header}</div><div class="version">v${_VERSION_}</div><button onclick="reloadPage()">${messages.reload}</button><script>function reloadPage(){location.reload(!0)}</script></body></html>`;
}

self.addEventListener("fetch", (ev) => {
	let isHTMLRequest = false;
	if (ev.request.headers.get("sec-fetch-dest") === "document") {
		isHTMLRequest = true;
	} else if (ev.request.headers.get("accept")?.includes("/html")) {
		isHTMLRequest = true;
	} else if (ev.request.url.endsWith("/")) {
		isHTMLRequest = true;
	}

	if (!isHTMLRequest) return;
	ev.respondWith(
		fetch(ev.request)
		.catch(async () => {
			const html = await offlineContentHTML();
			return new Response(html, {
					status: 200,
					headers: {
						'content-type': 'text/html',
					},
				});
			}
		),
	);
});

self.addEventListener("push", (ev) => {
	// クライアント取得
	ev.waitUntil(
		self.clients
			.matchAll({
				includeUncontrolled: true,
				type: "window",
			})
			.then(
				async <K extends keyof pushNotificationDataMap>(
					clients: readonly WindowClient[],
				) => {
					const data: pushNotificationDataMap[K] = ev.data?.json();

					switch (data.type) {
						// case 'driveFileCreated':
						case "notification":
						case "unreadMessagingMessage":
							// 1日以上経過している場合は無視
							if (new Date().getTime() - data.dateTime > 1000 * 60 * 60 * 24)
								break;

							// クライアントがあったらストリームに接続しているということなので通知しない
							// クライアント接続中も通知する
							// if (clients.length !== 0) break;

							return createNotification(data);
						case "readAllNotifications":
							for (const n of await self.registration.getNotifications()) {
								if (n?.data?.type === "notification") n.close();
							}
							break;
						case "readAllMessagingMessages":
							for (const n of await self.registration.getNotifications()) {
								if (n?.data?.type === "unreadMessagingMessage") n.close();
							}
							break;
						case "readNotifications":
							for (const n of await self.registration.getNotifications()) {
								if (data.body?.notificationIds?.includes(n.data.body.id)) {
									n.close();
								}
							}
							break;
						case "readAllMessagingMessagesOfARoom":
							for (const n of await self.registration.getNotifications()) {
								if (
									n.data.type === "unreadMessagingMessage" &&
									("userId" in data.body
										? data.body.userId === n.data.body.userId
										: data.body.groupId === n.data.body.groupId)
								) {
									n.close();
								}
							}
							break;
					}

					await createEmptyNotification(`NotNfType : ${data.type}`);
					return;
				},
			),
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
							case "follow":
								if ("userId" in data.body)
									await swos.api("following/create", id, {
										userId: data.body.userId,
									});
								break;
							case "showUser":
								if ("user" in data.body)
									client = await swos.openUser(getAcct(data.body.user), id);
								break;
							case "reply":
								if ("note" in data.body)
									client = await swos.openPost({ reply: data.body.note }, id);
								break;
							case "renote":
								if ("note" in data.body)
									await swos.api("notes/create", id, {
										renoteId: data.body.note.id,
									});
								break;
							case "accept":
								switch (data.body.type) {
									case "receiveFollowRequest":
										await swos.api("following/requests/accept", id, {
											userId: data.body.userId,
										});
										break;
									case "groupInvited":
										await swos.api("users/groups/invitations/accept", id, {
											invitationId: data.body.invitation.id,
										});
										break;
								}
								break;
							case "reject":
								switch (data.body.type) {
									case "receiveFollowRequest":
										await swos.api("following/requests/reject", id, {
											userId: data.body.userId,
										});
										break;
									case "groupInvited":
										await swos.api("users/groups/invitations/reject", id, {
											invitationId: data.body.invitation.id,
										});
										break;
								}
								break;
							case "showFollowRequests":
								client = await swos.openClient(
									"push",
									"/my/follow-requests",
									id,
								);
								break;
							default:
								switch (data.body.type) {
									case "receiveFollowRequest":
										client = await swos.openClient(
											"push",
											"/my/follow-requests",
											id,
										);
										break;
									case "groupInvited":
										client = await swos.openClient("push", "/my/groups", id);
										break;
									case "reaction":
										client = await swos.openNote(data.body.note.id, id);
										break;
									default:
										if ("note" in data.body) {
											client = await swos.openNote(data.body.note.id, id);
										} else if ("user" in data.body) {
											client = await swos.openUser(getAcct(data.body.user), id);
										}
										break;
								}
						}
						break;
					case "unreadMessagingMessage":
						client = await swos.openChat(data.body, id);
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

				if (typeof ev.data === "object") {
					// E.g. '[object Array]' → 'array'
					const otype = Object.prototype.toString
						.call(ev.data)
						.slice(8, -1)
						.toLowerCase();

					if (otype === "object") {
						if (ev.data.msg === "initialize") {
							swLang.setLang(ev.data.lang);
						}
					}
				}
			})(),
		);
	},
);
