<template>
	<div class="_formRoot">
		<FormSection>
			<template #label></template>
			<FormSwitch v-model="imageNewTab" class="_formBlock">{{
				i18n.ts.openImageInNewTab
			}}</FormSwitch>
			<FormSwitch v-model="enableInfiniteScroll" class="_formBlock">{{
				i18n.ts.enableInfiniteScroll
			}}</FormSwitch>
			<FormSelect v-model="doContextMenu" class="_formBlock">
				<template #label>{{ i18n.ts.doContextMenu }}</template>
				<option value="contextMenu">{{ i18n.ts.contextMenu }}</option>
				<option value="reactionPicker">{{ i18n.ts.reactionPicker }}</option>
				<option value="doNothing">{{ i18n.ts.doNothing }}</option>
			</FormSelect>
			<FormSwitch v-model="alwaysPostButton" class="_formBlock">{{
				i18n.ts.alwaysPostButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showDetailNoteClick" class="_formBlock">{{
				i18n.ts.showDetailNoteClick
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="noteReactionMenu" class="_formBlock">{{
				i18n.ts.noteReactionMenu
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="enableDataSaverMode" :disabled="autoSwitchDataSaver" class="_formBlock">{{
				i18n.ts.dataSaver
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="autoSwitchDataSaver" :disabled="!supportAutoDataSaver" class="_formBlock">{{
				i18n.ts.autoSwitchDataSaver
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="enableDataSaverMode || autoSwitchDataSaver" v-model="dataSaverDisabledBanner" class="_formBlock">{{
				i18n.ts.dataSaverDisabledBanner
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="enabledAirReply" class="_formBlock">{{
				i18n.ts.enabledAirReply
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="hiddenActivityChart" class="_formBlock">{{
				i18n.ts.hiddenActivityChart
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="disablePagesScript" class="_formBlock">{{
				i18n.ts.disablePagesScript
			}}</FormSwitch>
			<FormSwitch v-model="longLoading" class="_formBlock">{{
				i18n.ts.longLoading
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="copyPostRemoteEmojiCode" class="_formBlock">{{
				i18n.ts.copyPostRemoteEmojiCode
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="developerRenote" class="_formBlock">{{
				i18n.ts.developerRenote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="developerQuote" class="_formBlock">{{
				i18n.ts.developerQuote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="developerNoteMenu" class="_formBlock">{{
				i18n.ts.developerNoteMenu
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

			<FormSelect v-model="serverDisconnectedBehavior" class="_formBlock">
				<template #label>{{ i18n.ts.whenServerDisconnected }}</template>
				<option value="reload">
					{{ i18n.ts._serverDisconnectedBehavior.reload }}
				</option>
				<option value="dialog">
					{{ i18n.ts._serverDisconnectedBehavior.dialog }}
				</option>
				<option value="quiet">
					{{ i18n.ts._serverDisconnectedBehavior.quiet }}
				</option>
				<option value="nothing">
					{{ i18n.ts._serverDisconnectedBehavior.nothing }}
				</option>
			</FormSelect>
		</FormSection>
		<FormSection>
			<template #label></template>
			<FormRadios v-model="overridedDeviceKind" class="_formBlock">
				<template #label>{{ i18n.ts.overridedDeviceKind }}</template>
				<option :value="null">{{ i18n.ts.auto }}</option>
				<option value="smartphone">
					<i class="ph-device-mobile ph-bold ph-lg" />
					{{ i18n.ts.smartphone }}
				</option>
				<option value="tablet">
					<i class="ph-device-tablet ph-bold ph-lg" />
					{{ i18n.ts.tablet }}
				</option>
				<option value="desktop">
					<i class="ph-desktop ph-bold ph-lg" /> {{ i18n.ts.desktop }}
				</option>
				<option value="desktop-force">
					<i class="ph-desktop ph-bold ph-lg" />
					{{ i18n.ts.desktopForce }}
				</option>
			</FormRadios>

				
			<FormSelect v-if="!isMobile" v-model="remoteEmojisFetch" class="_formBlock">
				<template #label>{{ i18n.ts.remoteEmojisFetch }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option value="always">{{ i18n.ts._remoteEmojisFetchForPc.always }}</option>
				<option value="all">{{ i18n.ts._remoteEmojisFetchForPc.all }}</option>
				<option value="plus">{{ i18n.ts._remoteEmojisFetchForPc.plus }}</option>
				<option value="keep">{{ i18n.ts._remoteEmojisFetchForPc.keep }}</option>
				<option value="none">{{ i18n.ts._remoteEmojisFetchForPc.none }}</option>
			</FormSelect>
			<FormSelect v-else v-model="remoteEmojisFetch" class="_formBlock">
				<template #label>{{ i18n.ts.remoteEmojisFetch }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option value="all">{{ i18n.ts._remoteEmojisFetch.all }}</option>
				<option value="plus">{{ i18n.ts._remoteEmojisFetch.plus }}</option>
				<option value="keep">{{ i18n.ts._remoteEmojisFetch.keep }}</option>
				<option value="none">{{ i18n.ts._remoteEmojisFetch.none }}</option>
				<option value="always">{{ i18n.ts._remoteEmojisFetch.always }}</option>
			</FormSelect>

			<FormRange
				v-model="numberOfPageCache"
				:min="1"
				:max="10"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label>{{ i18n.ts.numberOfPageCache }}</template>
				<template #caption>{{
					i18n.ts.numberOfPageCacheDescription
				}}</template>
			</FormRange>

			<FormSwitch v-model="swipeOnDesktop" class="_formBlock">{{
				i18n.ts.swipeOnDesktop
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

			<FormSwitch v-model="notTopToSwipeStop" class="_formBlock" :disabled="!swipeOnDesktop">{{
				i18n.ts.notTopToSwipeStop
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

			<FormRange
				v-model="swipeTouchAngle"
				:min="1"
				:max="90"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label>{{ i18n.ts.swipeTouchAngle }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			</FormRange>

			<FormRange
				v-model="swipeThreshold"
				:min="0"
				:max="200"
				:step="2"
				easing
				class="_formBlock"
			>
				<template #label>{{ i18n.ts.swipeThreshold }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			</FormRange>

			<FormSwitch v-model="swipeCenteredSlides" class="_formBlock">{{
				i18n.ts.swipeCenteredSlides
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
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
import { isSupportNavigatorConnection } from '@/scripts/datasaver';

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

const developer = computed(
	defaultStore.makeGetterSetter("developer")
);
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

const overridedDeviceKind = computed(
	defaultStore.makeGetterSetter("overridedDeviceKind")
);
const enableInfiniteScroll = computed(
	defaultStore.makeGetterSetter("enableInfiniteScroll")
);
const swipeOnDesktop = computed(
	defaultStore.makeGetterSetter("swipeOnDesktop")
);
const notTopToSwipeStop = computed(
	defaultStore.makeGetterSetter("notTopToSwipeStop")
);
const hiddenActivityChart = computed(
	defaultStore.makeGetterSetter("hiddenActivityChart")
);
const remoteEmojisFetch = $computed(
	defaultStore.makeGetterSetter("remoteEmojisFetch")
);
const supportAutoDataSaver = computed(() => isSupportNavigatorConnection());

const serverDisconnectedBehavior = computed(
	defaultStore.makeGetterSetter("serverDisconnectedBehavior")
);

const imageNewTab = computed(defaultStore.makeGetterSetter("imageNewTab"));
const disablePagesScript = computed(
	defaultStore.makeGetterSetter("disablePagesScript")
);
const numberOfPageCache = computed(
	defaultStore.makeGetterSetter("numberOfPageCache")
);
const doContextMenu = computed(
	defaultStore.makeGetterSetter("doContextMenu")
);
const developerRenote = computed(
	defaultStore.makeGetterSetter("developerRenote")
);
const developerQuote = computed(
	defaultStore.makeGetterSetter("developerQuote")
);
const developerNoteMenu = computed(
	defaultStore.makeGetterSetter("developerNoteMenu")
);
const copyPostRemoteEmojiCode = computed(
	defaultStore.makeGetterSetter("copyPostRemoteEmojiCode")
);
const enableDataSaverMode = $computed(
	defaultStore.makeGetterSetter("enableDataSaverMode")
);
const dataSaverDisabledBanner = $computed(
	defaultStore.makeGetterSetter("dataSaverDisabledBanner")
);
const showDetailNoteClick = $computed(
	defaultStore.makeGetterSetter("showDetailNoteClick")
);
const alwaysPostButton = $computed(
	defaultStore.makeGetterSetter("alwaysPostButton")
);
const longLoading = $computed(
	defaultStore.makeGetterSetter("longLoading")
);
const swipeTouchAngle = $computed(
	defaultStore.makeGetterSetter("swipeTouchAngle")
);
const swipeThreshold = $computed(
	defaultStore.makeGetterSetter("swipeThreshold")
);
const swipeCenteredSlides = $computed(
	defaultStore.makeGetterSetter("swipeCenteredSlides")
);
const autoSwitchDataSaver = $computed(
	defaultStore.makeGetterSetter("autoSwitchDataSaver")
);
const enabledAirReply = computed(
	defaultStore.makeGetterSetter("enabledAirReply")
);
const noteReactionMenu = $computed(
	defaultStore.makeGetterSetter('noteReactionMenu')
);
async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

watch(
	[
		enableInfiniteScroll,
		overridedDeviceKind,
		swipeOnDesktop,
		hiddenActivityChart,
		remoteEmojisFetch,
	],
	async () => {
		await reloadAsk();
	}
);

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.behavior,
	icon: "ph-list-dashes ph-bold ph-lg",
});
</script>
