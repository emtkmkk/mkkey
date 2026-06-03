<template>
	<div class="_formRoot">
		<FormButton class="_formBlock" @click="configure"
			><template #icon><i class="ph-gear-six ph-bold ph-lg"></i></template
			>{{ i18n.ts.notificationSetting }}</FormButton
		>
		<FormSwitch v-model="enableAntennaTab">
			<template #label
				>{{ i18n.ts.enableAntennaTab
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
		</FormSwitch>
		<FormSwitch v-model="disableRequestNotification">
			<template #label
				>{{ i18n.ts.disableRequestNotification
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
		</FormSwitch>
		<FormSection>
			<ForFormButtonmLink
				class="_formBlock"
				@click="readAllNotifications"
				>{{ i18n.ts.markAsReadAllNotifications }}</ForFormButtonmLink
			>
			<FormButton class="_formBlock" @click="readAllUnreadNotes">{{
				i18n.ts.markAsReadAllUnreadNotes
			}}</FormButton>
			<FormButton class="_formBlock" @click="readAllMessagingMessages">{{
				i18n.ts.markAsReadAllTalkMessages
			}}</FormButton>
		</FormSection>
		<FormSection>
			<template #label>{{ i18n.ts.pushNotification }}</template>

			<div class="_gaps_m">
				<MkPushNotificationAllowButton ref="allowButton" />
				<FormSwitch v-model="suppressPushWhenForeground">
					<template #label
						>画面を開いている間はこの端末で通知を表示しない</template
					>
					<template #caption
						>オンにすると、タブを表示中は OS の通知の代わりにアプリ内トーストで知らせます。</template
					>
				</FormSwitch>
				<FormButton
					class="_formBlock"
					:disabled="!pushRegistrationInServer"
					@click="sendTestPush"
				>
					テスト通知を送る
				</FormButton>
			</div>
		</FormSection>
		<FormSection v-if="developer">
			<template #label>【dev】プッシュ通知ログ</template>
			<div class="_gaps_s">
				<FormButton class="_formBlock" :disabled="loadingLog" @click="loadPushLog">
					ログを更新
				</FormButton>
				<div v-if="pushLogs.length === 0" class="_caption">
					ログはありません
				</div>
				<div
					v-for="(entry, i) in pushLogs"
					:key="i"
					class="_monospace"
					style="font-size: 0.85em; word-break: break-all"
				>
					{{ formatLogEntry(entry) }}
				</div>
			</div>
		</FormSection>
		<FormSection>
			<FormLink to="/settings/webhook" class="_formBlock"
				><template #icon
					><i class="ph-lightning ph-bold ph-lg"></i></template
				>Webhookによる通知の受け取り設定 (Discordなど)<span
					v-if="showMkkeySettingTips"
					class="_beta"
					>{{ i18n.ts.mkkey }}</span
				></FormLink
			>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 通知設定ページ。
 *
 * @public
 */
import { defineAsyncComponent, watch } from "vue";
import { notificationTypes } from "calckey-js";
import FormButton from "@/components/MkButton.vue";
import FormLink from "@/components/form/link.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import MkPushNotificationAllowButton from "@/components/MkPushNotificationAllowButton.vue";
import {
	buildMutingNotificationTypes,
	getConfigurableNotificationTypes,
} from "@/scripts/experimental-notification-types";

let allowButton =
	$shallowRef<InstanceType<typeof MkPushNotificationAllowButton>>();
const pushRegistrationInServer = $computed(
	() => allowButton?.pushRegistrationInServer,
);

const developer = $computed(defaultStore.makeGetterSetter("developer"));
const enableAntennaTab = $computed(
	defaultStore.makeGetterSetter("enableAntennaTab"),
);
const disableRequestNotification = $computed(
	defaultStore.makeGetterSetter("disableRequestNotification"),
);
const showMkkeySettingTips = $computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips"),
);
const suppressPushWhenForeground = $computed(
	defaultStore.makeGetterSetter("suppressPushWhenForeground"),
);

let pushLogs = $ref<
	Array<{
		at: number;
		kind: string;
		type?: string;
		event?: string;
		cause?: string;
		endpointHash?: string;
		ok?: boolean;
		statusCode?: number;
		errorMsg?: string;
	}>
>([]);
let loadingLog = $ref(false);

async function readAllUnreadNotes() {
	await os.api("i/read-all-unread-notes");
}

async function readAllMessagingMessages() {
	await os.api("i/read-all-messaging-messages");
}

async function readAllNotifications() {
	await os.api("notifications/mark-all-as-read");
}

async function sendTestPush() {
	const res = await os.apiWithDialog("i/test-push-notification", {});
	if (res.ok) {
		os.toast("テスト通知を送信しました");
		if (developer) await loadPushLog();
	} else {
		os.alert({
			type: "warning",
			text: "プッシュ通知の購読が登録されていません",
		});
	}
}

async function loadPushLog() {
	loadingLog = true;
	try {
		pushLogs = await os.api("i/push-log", { limit: 50 });
	} catch {
		pushLogs = [];
	} finally {
		loadingLog = false;
	}
}

function formatLogEntry(entry: (typeof pushLogs)[number]): string {
	const time = new Date(entry.at).toLocaleString();
	if (entry.kind === "subscription") {
		return `${time} [購読] ${entry.event} (${entry.cause}) ${entry.endpointHash ?? ""}`;
	}
	return `${time} [送信] ${entry.type} ok=${entry.ok} status=${entry.statusCode ?? "-"} ${entry.endpointHash ?? ""} ${entry.errorMsg ?? ""}`;
}

function configure() {
	const visibleTypes = getConfigurableNotificationTypes(developer);
	const includingTypes = visibleTypes.filter(
		(x) => !$i!.mutingNotificationTypes.includes(x),
	);
	os.popup(
		defineAsyncComponent(
			() => import("@/components/MkNotificationSettingWindow.vue"),
		),
		{
			includingTypes,
			configurableTypes: visibleTypes,
			showGlobalToggle: false,
		},
		{
			done: async (res) => {
				const { includingTypes: value } = res;
				await os
					.apiWithDialog("i/update", {
						mutingNotificationTypes: buildMutingNotificationTypes(
							developer,
							value ?? [],
							$i!.mutingNotificationTypes,
						),
					})
					.then((i) => {
						$i!.mutingNotificationTypes = i.mutingNotificationTypes;
					});
			},
		},
		"closed",
	);
}

watch(
	() => developer,
	(v) => {
		if (v) void loadPushLog();
	},
	{ immediate: true },
);

definePageMetadata({
	title: i18n.ts.notifications,
	icon: "ph-bell ph-bold ph-lg",
});
</script>
