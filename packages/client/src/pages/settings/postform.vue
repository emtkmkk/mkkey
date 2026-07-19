<template>
	<div class="_formRoot">
            <FormSection>
                        <template #label>{{ i18n.ts.behavior }}</template>
                        <FormSwitch v-model="enterSendsMessage" class="_formBlock">{{
                                i18n.ts.enterSendsMessage
                        }}</FormSwitch>
                        <FormSwitch
                                :disabled="!showCloseButton"
                                v-model="CloseAllClearButton"
                                class="_formBlock"
                        >{{ i18n.ts.CloseAllClearButton }}
                                        <span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></FormSwitch
												>
                        <FormSwitch
                                :disabled="!showMentionButton"
                                v-model="openMentionWindow"
                                class="_formBlock"
                        >{{ i18n.ts.openMentionWindow
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch v-model="keepPostCw" class="_formBlock"
                                >{{ i18n.ts.keepPostCw
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch v-model="keepCw" class="_formBlock">{{
                                i18n.ts.keepCw
                        }}</FormSwitch>
                        <FormSwitch v-model="smartMFMInputer" class="_formBlock"
                                >{{ i18n.ts.smartMFMInputer
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch v-model="quickToggleSmartMFMInputer" class="_formBlock"
                                >{{ i18n.ts.quickToggleSmartMFMInputer
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch
                                v-if="developer && $i?.canInvite"
                                v-model="enabledSpecifiedCc"
                                class="_formBlock"
                                >{{ i18n.ts.enabledSpecifiedCc
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span
                                ><template #caption>{{
                                        i18n.ts.enabledSpecifiedCcDescription
                                }}</template></FormSwitch
                        >
            </FormSection>
            <FormSection>
                        <template #label>{{ i18n.ts.emoji }}</template>
                        <FormSwitch v-model="openEmojiPicker" class="_formBlock"
                                >{{ i18n.ts.openEmojiPicker
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch
                                :disabled="!openEmojiPicker"
                                v-model="postAutoFocusSearchBar"
                                class="_formBlock"
                                >{{ i18n.ts.postAutoFocusSearchBar
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch
                                :disabled="!openEmojiPicker"
                                v-model="notCloseEmojiPicker"
                                class="_formBlock"
                                >{{ i18n.ts.notCloseEmojiPicker
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch
                                v-model="showRemoteEmojiPostForm"
                                :disabled="showRemoteEmojiPostFormDisabled"
                                class="_formBlock"
                                >{{ i18n.ts.showRemoteEmojiPostForm
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <FormSwitch v-model="usePickerSizePostForm" class="_formBlock">
                                {{ i18n.ts.usePickerSizePostForm
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span>
                        </FormSwitch>
                        <FormSwitch
                                v-model="emojiPickerUseDrawerForMobile"
                                class="_formBlock"
                                >{{ i18n.ts.emojiPickerUseDrawerForMobile
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
            </FormSection>
            <FormSection>
                        <template #label>{{ i18n.ts.display }}</template>
                        <FormSwitch v-model="plusInfoPostForm" class="_formBlock"
                                >{{ i18n.ts.plusInfoPostForm
                                }}<span v-if="showMkkeySettingTips" class="_beta">{{
                                        i18n.ts.mkkey
                                }}</span></FormSwitch
                        >
                        <div class="postFormGroupLabel _formBlock">
                                {{ i18n.ts.postFormDisableTabNavigation }}
                        </div>
                        <FormSwitch v-model="postFormHeaderButtonsTabindexMinusOne" class="_formBlock">
                                {{ i18n.ts.postFormHeaderButtonsTabindexMinusOne }}
                        </FormSwitch>
                        <FormSwitch v-model="postFormFooterButtonsTabindexMinusOne" class="_formBlock">
                                {{ i18n.ts.postFormFooterButtonsTabindexMinusOne }}
                        </FormSwitch>
                        <div class="postFormSectionDivider _formBlock" aria-hidden="true"></div>
                        <div class="postFormGroupLabel _formBlock">
                                {{ i18n.ts.postFormHeaderButtons }}
                        </div>
                        <FormSwitch v-model="showCloseButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-x ph-bold ph-lg"></i
                                        ><span>{{ closeButtonLabel }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showAccountButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-user-circle ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenAccountButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showTextCount" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-text-t ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenTextCount }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showDraftButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-notepad ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenDraftButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showMFMHelp" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-question ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenMFMHelp }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showPostButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-paper-plane-tilt ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenPostButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <div class="postFormSectionDivider _formBlock" aria-hidden="true"></div>
                        <div class="postFormGroupLabel _formBlock">
                                {{ i18n.ts.postFormFooterButtons }}
                        </div>
                        <FormSwitch v-model="showUploadButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-upload ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenUploadButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showPollButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-microphone-stage ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenPollButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showCwButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-eye-slash ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenCwButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showMentionButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-at ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenMentionButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showHashtagButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-hash ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenHashtagButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showEmojiButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-smiley ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenEmojiButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showMFMButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-magic-wand ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenMFMButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showPreviewButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-binoculars ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenPreviewButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch v-model="showPostLockButton" class="_formBlock">
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-lock ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenPostLockButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch
                                v-model="showNowPlayingButton"
                                class="_formBlock"
                                :disabled="!isNowPlayingSupported"
                        >
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-music-notes ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenNowPlayingButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <!-- 表示条件を満たすときのみ、Swarm/プラグインボタンの表示切替を表示 -->
                        <FormSwitch
                                v-if="showSwarmButtonInSettings"
                                v-model="showSwarmButton"
                                class="_formBlock"
                        >
                                <span class="postFormSwitchLabel"
                                        ><span class="swarm-icon" role="img" aria-hidden="true"></span>
                                        <span>{{ i18n.ts.hiddenSwarmButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
                        <FormSwitch
                                v-if="showPluginButtonInSettings"
                                v-model="showPluginButton"
                                class="_formBlock"
                        >
                                <span class="postFormSwitchLabel"
                                        ><i class="ph-plug ph-bold ph-lg"></i
                                        ><span>{{ i18n.ts.hiddenPluginButton }}</span
                                        ><span v-if="showMkkeySettingTips" class="_beta">{{
                                                i18n.ts.mkkey
                                        }}</span></span
                                >
                        </FormSwitch>
            </FormSection>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore, postFormActions } from "@/store";
import { instance } from "@/instance";
import { unisonReload } from "@/scripts/unison-reload";
import { useIsMobile } from "@/scripts/use-is-mobile";

const DESKTOP_THRESHOLD = 1100;
const isNowPlayingSupported =
	typeof navigator !== "undefined" && "mediaSession" in navigator;

const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = useIsMobile();

const developer = computed(defaultStore.makeGetterSetter("developer"));
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

const emojiPickerUseDrawerForMobile = computed(
	defaultStore.makeGetterSetter("emojiPickerUseDrawerForMobile")
);
const enterSendsMessage = computed(
	defaultStore.makeGetterSetter("enterSendsMessage")
);
const openEmojiPicker = computed(
	defaultStore.makeGetterSetter("openEmojiPicker")
);
const postAutoFocusSearchBar = computed(
	defaultStore.makeGetterSetter("postAutoFocusSearchBar")
);
const notCloseEmojiPicker = computed(
	defaultStore.makeGetterSetter("notCloseEmojiPicker")
);
const hiddenMFMHelp = computed(defaultStore.makeGetterSetter("hiddenMFMHelp"));
const hiddenPostButton = computed(
	defaultStore.makeGetterSetter("hiddenPostButton")
);
const hiddenTextCount = computed(
	defaultStore.makeGetterSetter("hiddenTextCount")
);
const hiddenMentionButton = computed(
	defaultStore.makeGetterSetter("hiddenMentionButton")
);
const hiddenDraftButton = computed(
	defaultStore.makeGetterSetter("hiddenDraftButton")
);
const hiddenCloseButton = computed(
	defaultStore.makeGetterSetter("hiddenCloseButton")
);
const hiddenAccountButton = computed(
	defaultStore.makeGetterSetter("hiddenAccountButton")
);
const CloseAllClearButton = computed(
	defaultStore.makeGetterSetter("CloseAllClearButton")
);
const hiddenUploadButton = computed(
	defaultStore.makeGetterSetter("hiddenUploadButton")
);
const hiddenPollButton = computed(
	defaultStore.makeGetterSetter("hiddenPollButton")
);
const hiddenCwButton = computed(
	defaultStore.makeGetterSetter("hiddenCwButton")
);
const hiddenHashtagButton = computed(
	defaultStore.makeGetterSetter("hiddenHashtagButton")
);
const hiddenEmojiButton = computed(
	defaultStore.makeGetterSetter("hiddenEmojiButton")
);
const hiddenMFMButton = computed(
	defaultStore.makeGetterSetter("hiddenMFMButton")
);
const hiddenPreviewButton = computed(
	defaultStore.makeGetterSetter("hiddenPreviewButton")
);
const hiddenPostLockButton = computed(
	defaultStore.makeGetterSetter("hiddenPostLockButton")
);
const hiddenNowPlayingButton = computed(
	defaultStore.makeGetterSetter("hiddenNowPlayingButton")
);
const hiddenSwarmButton = computed(
	defaultStore.makeGetterSetter("hiddenSwarmButton")
);
const hiddenPluginButton = computed(
	defaultStore.makeGetterSetter("hiddenPluginButton")
);
const postFormHeaderButtonsTabindexMinusOne = computed(
	defaultStore.makeGetterSetter("postFormHeaderButtonsTabindexMinusOne")
);
const postFormFooterButtonsTabindexMinusOne = computed(
	defaultStore.makeGetterSetter("postFormFooterButtonsTabindexMinusOne")
);
const closeButtonLabel = computed(() =>
        CloseAllClearButton.value
                ? i18n.ts.postFormClearButtonLabel
                : i18n.ts.hiddenCloseButton
);
const invertBool = (source: { value: boolean }) =>
	computed({
		get: () => !source.value,
		set: (value: boolean) => {
			source.value = !value;
		},
	});
const showPostButton = invertBool(hiddenPostButton);
const showCloseButton = invertBool(hiddenCloseButton);
const showAccountButton = invertBool(hiddenAccountButton);
const showTextCount = invertBool(hiddenTextCount);
const showDraftButton = invertBool(hiddenDraftButton);
const showMFMHelp = invertBool(hiddenMFMHelp);
const showUploadButton = invertBool(hiddenUploadButton);
const showPollButton = invertBool(hiddenPollButton);
const showCwButton = invertBool(hiddenCwButton);
const showMentionButton = invertBool(hiddenMentionButton);
const showHashtagButton = invertBool(hiddenHashtagButton);
const showEmojiButton = invertBool(hiddenEmojiButton);
const showMFMButton = invertBool(hiddenMFMButton);
const showPreviewButton = invertBool(hiddenPreviewButton);
const showPostLockButton = invertBool(hiddenPostLockButton);
const showNowPlayingButton = invertBool(hiddenNowPlayingButton);
const showSwarmButton = invertBool(hiddenSwarmButton);
const showPluginButton = invertBool(hiddenPluginButton);
/** 投稿フォームに Swarm ボタンが表示される条件（設定画面でスイッチを出すかどうか） */
const showSwarmButtonInSettings = computed(
	() =>
		Boolean(
			instance.enableSwarmIntegration &&
				$i?.integrations?.swarm?.accessToken &&
				$i?.integrations?.swarm?.showPostFormButton,
		),
);
/** 投稿フォームにプラグインボタンが表示される条件（設定画面でスイッチを出すかどうか） */
const showPluginButtonInSettings = computed(
	() => postFormActions.length > 0,
);
const openMentionWindow = computed(
	defaultStore.makeGetterSetter("openMentionWindow")
);
const smartMFMInputer = computed(
	defaultStore.makeGetterSetter("smartMFMInputer")
);
const quickToggleSmartMFMInputer = computed(
	defaultStore.makeGetterSetter("quickToggleSmartMFMInputer")
);
const keepCw = computed(defaultStore.makeGetterSetter("keepCw"));
const keepPostCw = computed(defaultStore.makeGetterSetter("keepPostCw"));
const plusInfoPostForm = computed(
        defaultStore.makeGetterSetter("plusInfoPostForm")
);
const showRemoteEmojiPostForm = computed(
        defaultStore.makeGetterSetter("showRemoteEmojiPostForm")
);
const showRemoteEmojiTimeline = computed(
	defaultStore.makeGetterSetter("showRemoteEmojiTimeline")
);
const showRemoteEmojiPostFormDisabled = computed(
	() => !showRemoteEmojiTimeline.value && !showRemoteEmojiPostForm.value
);
const usePickerSizePostForm = computed(
        defaultStore.makeGetterSetter("usePickerSizePostForm")
);
const enabledSpecifiedCc = computed(
        defaultStore.makeGetterSetter("enabledSpecifiedCc")
);

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

watch([emojiPickerUseDrawerForMobile], async () => {
	await reloadAsk();
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePageMetadata({
	title: i18n.ts.postForm,
	icon: "ph-note-pencil ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.postFormSwitchLabel {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
}

.postFormGroupLabel {
	font-weight: 700;
	color: var(--fg);
	margin-top: 0.5rem;
}

.postFormSectionDivider {
	height: 0;
	margin: 0.75rem 0;
	border-top: solid 0.03125rem var(--divider);
}
</style>
