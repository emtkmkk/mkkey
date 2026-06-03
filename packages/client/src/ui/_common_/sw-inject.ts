import { post } from "@/os";
import { $i, login } from "@/account";
import { defaultStore } from "@/store";
import { getAccountFromId } from "@/scripts/get-account-from-id";
import { mainRouter } from "@/router";
import * as os from "@/os";
import { reregisterPushSubscriptionAfterChange } from "@/scripts/push-subscription-register";
import { i18n } from "@/i18n";

/**
 * フォアグラウンド転送時の in-app トースト文言を組み立てる。
 *
 * @param body - push ペイロードの notification body
 * @returns トースト用テキスト。未対応なら null
 * @internal
 */
function formatInAppNotificationToast(body: {
	type?: string;
	user?: { name?: string | null; username?: string };
	note?: { text?: string };
}): string | null {
	if (body.type == null) return null;

	const name = body.user?.name || body.user?.username || "";
	const withName = (text: string) => (name ? `${name}: ${text}` : text);

	switch (body.type) {
		case "userWasUnfollowed":
			return withName(i18n.ts._notification.youWereUnfollowed);
		case "wasForciblyUnfollowed":
			return withName(i18n.ts._notification.youWereForciblyUnfollowed);
		case "wasBlocked":
			return withName(i18n.ts._notification.youWereBlocked);
		case "wasUnblocked":
			return withName(i18n.ts._notification.youWereUnblocked);
		case "followedAccountWasDeleted":
			return name
				? i18n.t("_notification.followedAccountWasDeleted", { name })
				: i18n.ts._notification.followedAccountWasDeleted;
		default:
			return null;
	}
}

/**
 * Service Worker からのメッセージを処理する。
 *
 * @internal
 */
export function swInject() {
	window.addEventListener("mkkey-pushsubscriptionchange", () => {
		void reregisterPushSubscriptionAfterChange();
	});

	navigator.serviceWorker.addEventListener("message", (ev) => {
		if (defaultStore.state.developer || _DEV_) {
			if (ev.data?.type === "sw-debug" || ev.data?.type === "in-app-notification") {
				console.info("[mkkey-sw]", ev.data);
			} else if (_DEV_) {
				console.log("sw msg", ev.data);
			}
		}

		if (ev.data?.type === "in-app-notification") {
			const data = ev.data.data;
			if (
				data?.type === "notification" &&
				data.body?.type === "app" &&
				data.body?.header === "プッシュ通知テスト"
			) {
				os.toast("プッシュ通知テスト: 届きました");
				return;
			}
			if (data?.type === "notification" && data.body != null) {
				const typedToast = formatInAppNotificationToast(data.body);
				os.toast(
					typedToast ??
						data.body.note?.text?.slice(0, 80) ??
						"新しい通知があります",
				);
				return;
			}
			if (data?.type === "unreadMessagingMessage") {
				os.toast("新しいメッセージがあります");
				return;
			}
			return;
		}

		// 鍵ローテーション時の再登録（明示オフ時は reregister 内で抑止）
		if (ev.data?.type === "pushsubscriptionchange") {
			window.dispatchEvent(new CustomEvent("mkkey-pushsubscriptionchange"));
			return;
		}

		if (ev.data.type !== "order") return;

		if (ev.data.loginId !== $i?.id) {
			return getAccountFromId(ev.data.loginId).then((account) => {
				if (!account) return;
				return login(account.token, ev.data.url);
			});
		}

		switch (ev.data.order) {
			case "post":
				return post(ev.data.options);
			case "push":
				if (mainRouter.currentRoute.value.path === ev.data.url) {
					return window.scroll({ top: 0, behavior: "smooth" });
				}
				return mainRouter.push(ev.data.url);
			default:
				return;
		}
	});
}
