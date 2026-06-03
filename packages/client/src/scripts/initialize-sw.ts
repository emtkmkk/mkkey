import { lang } from "@/config";
import { $i } from "@/account";
import { instance } from "@/instance";
import { defaultStore } from "@/store";
import {
	postDeveloperModeToSw,
	postSuppressPushWhenForegroundToSw,
} from "@/scripts/push-notification-sync";

/**
 * Service Worker を登録し、言語・dev モードを同期する。
 *
 * @remarks
 * NOTE: `enableServiceWorker` が無効なときは SW を登録しない。
 *
 * @internal
 */
export async function initializeSw() {
	if (!("serviceWorker" in navigator)) return;
	if (!instance.enableServiceWorker) return;

	navigator.serviceWorker.register("/sw.js", { scope: "/", type: "classic" });
	navigator.serviceWorker.ready.then((registration) => {
		registration.active?.postMessage({
			msg: "initialize",
			lang,
			developer: defaultStore.state.developer,
			suppressPushWhenForeground:
				defaultStore.state.suppressPushWhenForeground,
			userId: $i?.id,
		});
		postDeveloperModeToSw(defaultStore.state.developer);
		if ($i?.id != null) {
			postSuppressPushWhenForegroundToSw(
				defaultStore.state.suppressPushWhenForeground,
				$i.id,
			);
		}
	});
}
