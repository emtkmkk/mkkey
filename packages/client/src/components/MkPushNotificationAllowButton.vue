<template>
	<MkButton
		v-if="supported && !pushRegistrationInServer"
		type="button"
		primary
		:gradate="gradate"
		:rounded="rounded"
		:inline="inline"
		:autofocus="autofocus"
		:wait="wait"
		:full="full"
		@click="subscribe"
	>
		{{ i18n.ts.subscribePushNotification }}
	</MkButton>
	<MkButton
		v-else-if="
			!showOnlyToRegister &&
			($i ? pushRegistrationInServer : pushSubscription)
		"
		type="button"
		:primary="false"
		:gradate="gradate"
		:rounded="rounded"
		:inline="inline"
		:autofocus="autofocus"
		:wait="wait"
		:full="full"
		@click="unsubscribe"
	>
		{{ i18n.ts.unsubscribePushNotification }}
	</MkButton>
	<MkButton
		v-else-if="$i && pushRegistrationInServer"
		disabled
		:rounded="rounded"
		:inline="inline"
		:wait="wait"
		:full="full"
	>
		{{ i18n.ts.pushNotificationAlreadySubscribed }}
	</MkButton>
	<MkButton
		v-else-if="!supported"
		disabled
		:rounded="rounded"
		:inline="inline"
		:wait="wait"
		:full="full"
	>
		{{
			permissionDenied
				? "ブラウザの設定で通知が拒否されています"
				: i18n.ts.pushNotificationNotSupported
		}}
	</MkButton>
</template>

<script setup lang="ts">
/**
 * @packageDocumentation
 *
 * プッシュ通知の購読・解除ボタン。
 *
 * @remarks
 * NOTE: サーバー未登録のブラウザ購読は自動で再 register する。
 *
 * @public
 */
import { $i } from "@/account";
import MkButton from "@/components/MkButton.vue";
import { instance } from "@/instance";
import { api, promiseDialog } from "@/os";
import { i18n } from "@/i18n";
import { getAccounts } from "@/account";
import {
	encodePushKey,
	registerPushSubscription,
	urlBase64ToUint8Array,
} from "@/scripts/push-subscription-register";

defineProps<{
	primary?: boolean;
	gradate?: boolean;
	rounded?: boolean;
	inline?: boolean;
	link?: boolean;
	to?: string;
	autofocus?: boolean;
	wait?: boolean;
	danger?: boolean;
	full?: boolean;
	showOnlyToRegister?: boolean;
}>();

let registration = $ref<ServiceWorkerRegistration | undefined>();
let supported = $ref(false);
let permissionDenied = $ref(false);
let pushSubscription = $ref<PushSubscription | null>(null);
let pushRegistrationInServer = $ref<
	| {
			state?: string;
			key?: string;
			userId: string;
			endpoint: string;
			sendReadMessage: boolean;
	  }
	| undefined
>();


function subscribe() {
	if (!registration || !supported || !instance.swPublickey) return;

	return promiseDialog(
		(async () => {
			if (
				"Notification" in window &&
				Notification.permission === "default"
			) {
				const perm = await Notification.requestPermission();
				if (perm === "denied") {
					permissionDenied = true;
					return;
				}
			}

			return registration!.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(instance.swPublickey!),
			});
		})()
			.then(async (subscription) => {
				if (!subscription) return;
				pushSubscription = subscription;
				pushRegistrationInServer = await registerPushSubscription(subscription);
			})
			.catch((err) => {
				if (err?.name === "NotAllowedError") {
					permissionDenied = true;
					console.info(
						"User denied the notification permission request.",
					);
					return;
				}
				console.error("Push subscribe failed:", err);
			}),
		null,
		null,
	);
}

async function unregister() {
	if (!pushSubscription) return;

	const endpoint = pushSubscription.endpoint;
	const accounts = await getAccounts();

	pushRegistrationInServer = undefined;

	// 複数アカウント時はブラウザ購読を維持しサーバー登録のみ削除
	if (accounts.length < 2) {
		await pushSubscription.unsubscribe();
		pushSubscription = null;
	}

	await api("sw/unregister", { endpoint, cause: "api-call" });
}

async function syncSubscriptionWithServer() {
	if (!registration || !pushSubscription || !$i?.token) return;

	const res = await api("sw/show-registration", {
		endpoint: pushSubscription.endpoint,
		auth: encodePushKey(pushSubscription.getKey("auth")),
		publickey: encodePushKey(pushSubscription.getKey("p256dh")),
	});

	if (res) {
		pushRegistrationInServer = res;
		return;
	}

	// 宙ぶらり: ブラウザに購読あり・サーバーに無し → 再登録
	try {
		pushRegistrationInServer = await registerPushSubscription(pushSubscription);
	} catch (err) {
		console.error("Failed to re-register push subscription:", err);
	}
}

if (navigator.serviceWorker == null) {
	supported = false;
} else {
	navigator.serviceWorker.ready.then(async (swr) => {
		registration = swr;
		pushSubscription = await registration.pushManager.getSubscription();

		if (instance.swPublickey && "PushManager" in window && $i?.token) {
			supported = true;
			permissionDenied = Notification.permission === "denied";

			if (pushSubscription) {
				await syncSubscriptionWithServer();
			}
		}
	});
}

defineExpose({
	pushRegistrationInServer: $$(pushRegistrationInServer),
});
</script>
