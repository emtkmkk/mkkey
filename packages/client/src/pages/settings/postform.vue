<template>
	<div class="_formRoot">
		<FormSection>
			<template #label></template>
			<FormSwitch v-model="enterSendsMessage" class="_formBlock">{{
				i18n.ts.enterSendsMessage
			}}</FormSwitch>
			<FormSwitch v-model="plusInfoPostForm" class="_formBlock"
				>{{ i18n.ts.plusInfoPostForm
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
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
			<FormSwitch v-model="showRemoteEmojiPostForm" class="_formBlock"
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
			<FormSwitch v-model="hiddenMentionButton" class="_formBlock"
				>{{ i18n.ts.hiddenMentionButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch
				:disabled="hiddenMentionButton"
				v-model="openMentionWindow"
				class="_formBlock"
				>{{ i18n.ts.openMentionWindow
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="hiddenCloseButton" class="_formBlock"
				>{{ i18n.ts.hiddenCloseButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch
				:disabled="hiddenCloseButton"
				v-model="CloseAllClearButton"
				class="_formBlock"
				>{{ i18n.ts.CloseAllClearButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="hiddenAccountButton" class="_formBlock"
				>{{ i18n.ts.hiddenAccountButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="hiddenMFMHelp" class="_formBlock"
				>{{ i18n.ts.hiddenMFMHelp
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
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
			<FormSwitch v-model="keepPostCw" class="_formBlock"
				>{{ i18n.ts.keepPostCw
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="keepCw" class="_formBlock">{{
				i18n.ts.keepCw
			}}</FormSwitch>
			<FormSwitch
				v-model="emojiPickerUseDrawerForMobile"
				class="_formBlock"
				>{{ i18n.ts.emojiPickerUseDrawerForMobile
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import FormButton from "@/components/MkButton.vue";
import FormLink from "@/components/form/link.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormInput from "@/components/form/input.vue";
import FormSelect from "@/components/form/select.vue";
import FormRadios from "@/components/form/radios.vue";
import FormRange from "@/components/form/range.vue";
import MkLink from "@/components/MkLink.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { deviceKind } from "@/scripts/device-kind";

const DESKTOP_THRESHOLD = 1100;
const MOBILE_THRESHOLD = 500;

// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = ref(
	deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD
);
window.addEventListener("resize", () => {
	isMobile.value =
		deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD;
});

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
const hiddenMentionButton = computed(
	defaultStore.makeGetterSetter("hiddenMentionButton")
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
const openMentionWindow = computed(
	defaultStore.makeGetterSetter("openMentionWindow")
);
const smartMFMInputer = computed(
	defaultStore.makeGetterSetter("smartMFMInputer")
);
const quickToggleSmartMFMInputer = computed(
	defaultStore.makeGetterSetter("quickToggleSmartMFMInputer")
);
let keepCw = $computed(defaultStore.makeGetterSetter("keepCw"));
let keepPostCw = $computed(defaultStore.makeGetterSetter("keepPostCw"));
const plusInfoPostForm = $computed(
	defaultStore.makeGetterSetter("plusInfoPostForm")
);
const showRemoteEmojiPostForm = $computed(
	defaultStore.makeGetterSetter("showRemoteEmojiPostForm")
);
const usePickerSizePostForm = $computed(
	defaultStore.makeGetterSetter("usePickerSizePostForm")
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

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.postForm,
	icon: "ph-note-pencil ph-bold ph-lg",
});
</script>
