<template>
	<div class="_formRoot">
		<FormSelect v-model="lang" class="_formBlock">
			<template #label>{{ i18n.ts.uiLanguage }}</template>
			<option v-for="x in langs" :key="x[0]" :value="x[0]">
				{{ x[1] }}
			</option>
		</FormSelect>

		<FormRadios v-model="showLocalPostsInTimeline" class="_formBlock">
			<template #label>{{ i18n.ts.showLocalPosts }}</template>
			<option value="home">
				<i class="ph-handshake ph-bold ph-lg" />
				{{ i18n.ts.homeTimeline }}
			</option>
			<option value="social">
				<i class="ph-house ph-bold ph-lg" />
				{{ i18n.ts.socialTimeline }}
			</option>
			<option value="both">
				<i class="ph-house ph-bold ph-lg" />
				<i class="ph-handshake ph-bold ph-lg" />
				{{ i18n.ts.bothTimeline }}
			</option>
		</FormRadios>

		<FormSwitch v-model="showFixedPostForm" class="_formBlock">{{
			i18n.ts.showFixedPostForm
		}}</FormSwitch>

		<FormSection>
			<template #label>{{ i18n.ts.behavior }}</template>
			<FormSwitch v-model="imageNewTab" class="_formBlock">{{
				i18n.ts.openImageInNewTab
			}}</FormSwitch>
			<FormSwitch v-model="enableInfiniteScroll" class="_formBlock">{{
				i18n.ts.enableInfiniteScroll
			}}</FormSwitch>
			<FormSwitch
				v-model="useReactionPickerForContextMenu"
				class="_formBlock"
				>{{ i18n.ts.useReactionPickerForContextMenu }}</FormSwitch
			>
			<FormSwitch v-model="swipeOnDesktop" class="_formBlock">{{
				i18n.ts.swipeOnDesktop
			}}</FormSwitch>
			<FormSwitch v-model="hiddenActivityChart" class="_formBlock">{{
				i18n.ts.hiddenActivityChart
			}}</FormSwitch>
			<FormSwitch v-model="diablePagesScript" class="_formBlock">{{
				i18n.ts.disablePagesScript
			}}</FormSwitch>
			<FormSwitch v-if="developer" v-model="developerRenote" class="_formBlock">{{
				i18n.ts.developerRenote
			}}</FormSwitch>
			<FormSwitch v-if="developer" v-model="developerQuote" class="_formBlock">{{
				i18n.ts.developerQuote
			}}</FormSwitch>
			<FormSwitch v-if="developer" v-model="developerNoteMenu" class="_formBlock">{{
				i18n.ts.developerNoteMenu
			}}</FormSwitch>

			<FormSelect v-model="serverDisconnectedBehavior" class="_fo\emtkmkk\calckey\src\branch\beta\packages\client\src\pages\settings\general.vuermBlock">
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
			<template #label>{{ i18n.ts.postForm }}</template>
			<FormSwitch v-model="enterSendsMessage" class="_formBlock">{{
				i18n.ts.enterSendsMessage
			}}</FormSwitch>
			<FormSwitch v-model="openEmojiPicker" class="_formBlock">{{
				i18n.ts.openEmojiPicker
			}}</FormSwitch>
			<FormSwitch v-if="openEmojiPicker" v-model="postAutoFocusSearchBar" class="_formBlock">{{
				i18n.ts.postAutoFocusSearchBar
			}}</FormSwitch>
			<FormSwitch v-if="openEmojiPicker" v-model="notCloseEmojiPicker" class="_formBlock">{{
				i18n.ts.notCloseEmojiPicker
			}}</FormSwitch>
			<FormSwitch v-model="hiddenMentionButton" class="_formBlock">{{
				i18n.ts.hiddenMentionButton
			}}</FormSwitch>
			<FormSwitch v-if="!hiddenMentionButton" v-model="openMentionWindow" class="_formBlock">{{
				i18n.ts.openMentionWindow
			}}</FormSwitch>
			<FormSwitch v-model="hiddenCloseButton" class="_formBlock">{{
				i18n.ts.hiddenCloseButton
			}}</FormSwitch>
			<FormSwitch v-model="hiddenMFMHelp" class="_formBlock">{{
				i18n.ts.hiddenMFMHelp
			}}</FormSwitch>
			<FormSwitch v-model="smartMFMInputer" class="_formBlock">{{
				i18n.ts.smartMFMInputer
			}}</FormSwitch>
			<FormSwitch v-model="emojiPickerUseDrawerForMobile" class="_formBlock">{{
				i18n.ts.emojiPickerUseDrawerForMobile
			}}</FormSwitch>
		</FormSection>

		<FormSection>
			<template #label>{{ i18n.ts.appearance }}</template>
			<FormSwitch v-model="autoplayMfm" class="_formBlock">
				{{ i18n.ts._mfm.alwaysPlay }}
				<template #caption>
					<i class="ph-warning ph-bold ph-lg" style="color: var(--warn)"></i>
					{{ i18n.ts._mfm.warn }}
				</template>
			</FormSwitch>
			<FormSwitch v-model="reduceAnimation" class="_formBlock">{{
				i18n.ts.reduceUiAnimation
			}}</FormSwitch>
			<FormSwitch v-model="useBlurEffect" class="_formBlock">{{
				i18n.ts.useBlurEffect
			}}</FormSwitch>
			<FormSwitch v-model="useBlurEffectForModal" class="_formBlock">{{
				i18n.ts.useBlurEffectForModal
			}}</FormSwitch>
			<FormSwitch
				v-model="showGapBetweenNotesInTimeline"
				class="_formBlock"
				>{{ i18n.ts.showGapBetweenNotesInTimeline }}</FormSwitch
			>
			<FormSwitch v-model="showRelationMark" class="_formBlock">{{
				i18n.ts.showRelationMark
			}}</FormSwitch>
			<FormSwitch v-model="loadRawImages" class="_formBlock">{{
				i18n.ts.loadRawImages
			}}</FormSwitch>
			<FormSwitch
				v-model="disableShowingAnimatedImages"
				class="_formBlock"
				>{{ i18n.ts.disableShowingAnimatedImages }}</FormSwitch
			>
			<FormSwitch v-model="squareAvatars" class="_formBlock">{{
				i18n.ts.squareAvatars
			}}</FormSwitch>
			<FormSwitch
				v-model="reactionShowUsername"
				class="_formBlock"
			>
				{{ i18n.ts.reactionShowUsername }}
			</FormSwitch>
			<FormSwitch
				v-model="reactionShowShort"
				class="_formBlock"
			>
				{{ i18n.ts.reactionShowShort }}
			</FormSwitch>
			<FormSwitch v-model="seperateRenoteQuote" class="_formBlock">{{
				i18n.ts.seperateRenoteQuote
			}}</FormSwitch>
			<FormSwitch v-model="useSystemFont" class="_formBlock">{{
				i18n.ts.useSystemFont
			}}</FormSwitch>
			<FormSwitch v-model="useOsNativeEmojis" class="_formBlock">
				{{ i18n.ts.useOsNativeEmojis }}
				<div>
					<Mfm :key="useOsNativeEmojis" text="🍮🍦🍭🍩🍰🍫🍬🥞🍪" />
				</div>
			</FormSwitch>
			<FormSwitch v-model="disableDrawer" class="_formBlock">{{
				i18n.ts.disableDrawer
			}}</FormSwitch>
			<FormSwitch v-model="showAds" class="_formBlock">{{
				i18n.ts.showAds
			}}</FormSwitch>
			<FormSwitch v-model="showUpdates" class="_formBlock">{{
				i18n.ts.showUpdates
			}}</FormSwitch>
			<FormSwitch v-if="developer" v-model="showMiniUpdates" class="_formBlock">{{
				i18n.ts.showMiniUpdates
			}}</FormSwitch>
			<FormSwitch
				v-if="$i?.isAdmin"
				v-model="showAdminUpdates"
				class="_formBlock"
				>{{ i18n.ts.showAdminUpdates }}</FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label>{{ i18n.ts.power }}</template>
			<FormSwitch v-model="powerMode" class="_formBlock">{{
				i18n.ts.powerMode
			}}</FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeColorful" class="_formBlock">{{
				i18n.ts.powerModeColorful
			}}</FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeNoShake" class="_formBlock">{{
				i18n.ts.powerModeNoShake
			}}</FormSwitch>
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
			</FormRadios>

			<FormRadios v-model="fontSize" class="_formBlock">
				<template #label>{{ i18n.ts.fontSize }}</template>
				<option value="-5">
					<span style="font-size: 11px">-5</span>
				</option>
				<option :value="-3">
					<span style="font-size: 13px">-3</span>
				</option>
				<option value="-2">
					<span style="font-size: 14px">-2</span>
				</option>
				<option value="-1">
					<span style="font-size: 15px">-1</span>
				</option>
				<option value="null">
					<span style="font-size: 16px">16px</span>
				</option>
				<option value="1">
					<span style="font-size: 17px">+1</span>
				</option>
				<option value="2">
					<span style="font-size: 18px">+2</span>
				</option>
				<option value="3">
					<span style="font-size: 18px">+3</span>
				</option>
				<option value="5">
					<span style="font-size: 20px">+5</span>
				</option>
			</FormRadios>
			
			<FormRadios v-model="avatarSize" class="_formBlock">
				<template #label>{{ i18n.ts.avatarSize }}</template>
				<option value="-2">
					極小
				</option>
				<option value="-1">
					小
				</option>
				<option value="null">
					中
				</option>
				<option value="1">
					大
				</option>
				<option value="2">
					特大
				</option>
				<option value="-3">
					豆粒
				</option>
				<option value="-4">
					非表示
				</option>
				<option value="f-1">
					固定（小）
				</option>
				<option value="f">
					固定（中）
				</option>
				<option value="f1">
					固定（大）
				</option>
			</FormRadios>
		</FormSection>

		<FormSelect v-model="instanceTicker" class="_formBlock">
			<template #label>{{ i18n.ts.instanceTicker }}</template>
			<option value="none">{{ i18n.ts._instanceTicker.none }}</option>
			<option value="remote">{{ i18n.ts._instanceTicker.remote }}</option>
			<option value="always">{{ i18n.ts._instanceTicker.always }}</option>
		</FormSelect>

		<FormSwitch v-if="developer" v-model="developerTicker" class="_formBlock">{{
			i18n.ts.developerTicker
		}}</FormSwitch>
		
		<FormSelect v-if="!isMobile" v-model="remoteEmojisFetch" class="_formBlock">
			<template #label>{{ i18n.ts.remoteEmojisFetch }}</template>
			<option value="always">{{ i18n.ts._remoteEmojisFetchForPc.always }}</option>
			<option value="all">{{ i18n.ts._remoteEmojisFetchForPc.all }}</option>
			<option value="plus">{{ i18n.ts._remoteEmojisFetchForPc.plus }}</option>
			<option value="none">{{ i18n.ts._remoteEmojisFetchForPc.none }}</option>
		</FormSelect>
		<FormSelect v-else v-model="remoteEmojisFetch" class="_formBlock">
			<template #label>{{ i18n.ts.remoteEmojisFetch }}</template>
			<option value="all">{{ i18n.ts._remoteEmojisFetch.all }}</option>
			<option value="plus">{{ i18n.ts._remoteEmojisFetch.plus }}</option>
			<option value="none">{{ i18n.ts._remoteEmojisFetch.none }}</option>
			<option value="always">{{ i18n.ts._remoteEmojisFetch.always }}</option>
		</FormSelect>
		
		<FormSelect v-model="nsfw" class="_formBlock">
			<template #label>{{ i18n.ts.nsfw }}</template>
			<option value="respect">{{ i18n.ts._nsfw.respect }}</option>
			<option value="ignore">{{ i18n.ts._nsfw.ignore }}</option>
			<option value="force">{{ i18n.ts._nsfw.force }}</option>
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

		<FormLink to="/settings/deck" class="_formBlock">{{
			i18n.ts.deck
		}}</FormLink>

		<FormLink to="/settings/custom-css" class="_formBlock"
			><template #icon><i class="ph-code ph-bold ph-lg"></i></template
			>{{ i18n.ts.customCss }}</FormLink
		>

		<FormLink to="/settings/custom-katex-macro" class="_formBlock"
			><template #icon><i class="ph-radical ph-bold ph-lg"></i></template
			>{{ i18n.ts.customKaTeXMacro }}</FormLink
		>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { $i } from "@/account";
import FormSwitch from "@/components/form/switch.vue";
import FormSelect from "@/components/form/select.vue";
import FormRadios from "@/components/form/radios.vue";
import FormRange from "@/components/form/range.vue";
import FormSection from "@/components/form/section.vue";
import FormLink from "@/components/form/link.vue";
import MkLink from "@/components/MkLink.vue";
import { langs } from "@/config";
import { defaultStore } from "@/store";
import * as os from "@/os";
import { unisonReload } from "@/scripts/unison-reload";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
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

const lang = ref(localStorage.getItem("lang"));
const fontSize = ref(localStorage.getItem("fontSize"));
const avatarSize = ref(localStorage.getItem("avatarSize"));
const useSystemFont = ref(localStorage.getItem("useSystemFont") != null);

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

const overridedDeviceKind = computed(
	defaultStore.makeGetterSetter("overridedDeviceKind")
);
const showLocalPostsInTimeline = computed(
	defaultStore.makeGetterSetter("showLocalPostsInTimeline")
);
const serverDisconnectedBehavior = computed(
	defaultStore.makeGetterSetter("serverDisconnectedBehavior")
);
const reduceAnimation = computed(
	defaultStore.makeGetterSetter(
		"animation",
		(v) => !v,
		(v) => !v
	)
);
const useBlurEffectForModal = computed(
	defaultStore.makeGetterSetter("useBlurEffectForModal")
);
const useBlurEffect = computed(defaultStore.makeGetterSetter("useBlurEffect"));
const showGapBetweenNotesInTimeline = computed(
	defaultStore.makeGetterSetter("showGapBetweenNotesInTimeline")
);
const showAds = computed(defaultStore.makeGetterSetter("showAds"));
const autoplayMfm = computed(
	defaultStore.makeGetterSetter(
		"animatedMfm",
		(v) => !v,
		(v) => !v
	)
);
const useOsNativeEmojis = computed(
	defaultStore.makeGetterSetter("useOsNativeEmojis")
);
const disableDrawer = computed(defaultStore.makeGetterSetter("disableDrawer"));
const emojiPickerUseDrawerForMobile = computed(defaultStore.makeGetterSetter("emojiPickerUseDrawerForMobile"));
const disableShowingAnimatedImages = computed(
	defaultStore.makeGetterSetter("disableShowingAnimatedImages")
);
const showRelationMark = computed(defaultStore.makeGetterSetter("showRelationMark"));
const loadRawImages = computed(defaultStore.makeGetterSetter("loadRawImages"));
const imageNewTab = computed(defaultStore.makeGetterSetter("imageNewTab"));
const nsfw = computed(defaultStore.makeGetterSetter("nsfw"));
const disablePagesScript = computed(
	defaultStore.makeGetterSetter("disablePagesScript")
);
const showFixedPostForm = computed(
	defaultStore.makeGetterSetter("showFixedPostForm")
);
const numberOfPageCache = computed(
	defaultStore.makeGetterSetter("numberOfPageCache")
);
const instanceTicker = computed(
	defaultStore.makeGetterSetter("instanceTicker")
);
const enableInfiniteScroll = computed(
	defaultStore.makeGetterSetter("enableInfiniteScroll")
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
const hiddenMFMHelp = computed(
	defaultStore.makeGetterSetter("hiddenMFMHelp")
);
const hiddenMentionButton = computed(
	defaultStore.makeGetterSetter("hiddenMentionButton")
);
const hiddenCloseButton = computed(
	defaultStore.makeGetterSetter("hiddenCloseButton")
);
const openMentionWindow = computed(
	defaultStore.makeGetterSetter("openMentionWindow")
);
const useReactionPickerForContextMenu = computed(
	defaultStore.makeGetterSetter("useReactionPickerForContextMenu")
);
const seperateRenoteQuote = computed(
	defaultStore.makeGetterSetter("seperateRenoteQuote")
);
const powerMode = computed(
	defaultStore.makeGetterSetter("powerMode")
);
const powerModeColorful = computed(
	defaultStore.makeGetterSetter("powerModeColorful")
);
const powerModeNoShake = computed(
	defaultStore.makeGetterSetter("powerModeNoShake")
);
const squareAvatars = computed(defaultStore.makeGetterSetter("squareAvatars"));
const showUpdates = computed(defaultStore.makeGetterSetter("showUpdates"));
const swipeOnDesktop = computed(
	defaultStore.makeGetterSetter("swipeOnDesktop")
);
const showAdminUpdates = computed(
	defaultStore.makeGetterSetter("showAdminUpdates")
);
const smartMFMInputer = computed(
	defaultStore.makeGetterSetter("smartMFMInputer")
);
const developer = computed(
	defaultStore.makeGetterSetter("developer")
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
const developerTicker = computed(
	defaultStore.makeGetterSetter("developerTicker")
);
const showMiniUpdates = computed(
	defaultStore.makeGetterSetter("showMiniUpdates")
);
const hiddenActivityChart = computed(
	defaultStore.makeGetterSetter("hiddenActivityChart")
);
const reactionShowUsername = $computed(
	defaultStore.makeGetterSetter("reactionShowUsername")
);
const reactionShowShort = $computed(
	defaultStore.makeGetterSetter("reactionShowShort")
);
const remoteEmojisFetch = $computed(
	defaultStore.makeGetterSetter("remoteEmojisFetch")
);

watch(lang, () => {
	localStorage.setItem("lang", lang.value as string);
	localStorage.removeItem("locale");
});

watch(fontSize, () => {
	if (fontSize.value == null) {
		localStorage.removeItem("fontSize");
	} else {
		localStorage.setItem("fontSize", fontSize.value);
	}
});

watch(avatarSize, () => {
	if (avatarSize.value == null) {
		localStorage.removeItem("avatarSize");
	} else {
		localStorage.setItem("avatarSize", avatarSize.value);
	}
});

watch(useSystemFont, () => {
	if (useSystemFont.value) {
		localStorage.setItem("useSystemFont", "t");
	} else {
		localStorage.removeItem("useSystemFont");
	}
});

watch(
	[
		lang,
		fontSize,
		avatarSize,
		useSystemFont,
		enableInfiniteScroll,
		squareAvatars,
		showGapBetweenNotesInTimeline,
		instanceTicker,
		overridedDeviceKind,
		showLocalPostsInTimeline,
		showAds,
		showUpdates,
		swipeOnDesktop,
		seperateRenoteQuote,
		showAdminUpdates,
		developerTicker,
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
	title: i18n.ts.general,
	icon: "ph-gear-six ph-bold ph-lg",
});
</script>
