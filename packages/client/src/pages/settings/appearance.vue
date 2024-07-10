<template>
	<div class="_formRoot" v-panel>
		<FormSection>
			<template #label></template>
			<FormSwitch v-model="autoplayMfm" class="_formBlock">
				{{ i18n.ts._mfm.alwaysPlay }}
				<template #caption>
					<i
						class="ph-warning ph-bold ph-lg"
						style="color: var(--warn)"
					></i>
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
			<FormSwitch v-model="hiddenHeaderIcon" class="_formBlock">{{
				i18n.ts.hiddenHeaderIcon
			}}</FormSwitch>
			<FormSwitch v-model="alwaysXExpand" class="_formBlock">{{
				i18n.ts.alwaysXExpand
			}}</FormSwitch>
			<FormSwitch v-model="showRelationMark" class="_formBlock"
				>{{ i18n.ts.showRelationMark
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="loadRawImages" class="_formBlock">{{
				i18n.ts.loadRawImages
			}}</FormSwitch>
			<FormSwitch v-model="loadOriginalImages" class="_formBlock">{{
				i18n.ts.loadOriginalImages
			}}</FormSwitch>
			<FormSwitch v-model="thumbnailCover" class="_formBlock"
				>{{ i18n.ts.thumbnailCover
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="compactGrid" class="_formBlock"
				>{{ i18n.ts.compactGrid
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="compactGridUrl" class="_formBlock"
				>{{ i18n.ts.compactGridUrl
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch
				v-model="disableShowingAnimatedImages"
				class="_formBlock"
				>{{ i18n.ts.disableShowingAnimatedImages }}</FormSwitch
			>
			<FormSwitch v-model="squareAvatars" class="_formBlock">{{
				i18n.ts.squareAvatars
			}}</FormSwitch>
			<FormSwitch v-model="reactionShowBig" class="_formBlock">
				{{ i18n.ts.reactionShowBig }}
				<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="reactionShowUsername" class="_formBlock">
				{{ i18n.ts.reactionShowUsername }}
				<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="reactionShowShort" class="_formBlock">
				{{ i18n.ts.reactionShowShort }}
				<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
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
			<FormSelect v-model="customFont">
				<template #label
					>{{ i18n.ts.customFont
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></template
				>
				<option :value="null">{{ i18n.ts.default }}</option>
				<option
					v-for="[name, font] of Object.entries(fontList)"
					:value="name"
				>
					{{ font.name }}
				</option>
			</FormSelect>
			<FormSwitch v-model="randomCustomFont" class="_formBlock">
				{{ i18n.ts.randomCustomFont }}
				<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch
				v-if="
					includesRandomEsenapaj ||
					(customFont === 'esenapaj' && randomCustomFont)
				"
				v-model="includesRandomEsenapaj"
				class="_formBlock"
			>
				{{ i18n.ts.includesRandomEsenapaj }}
				<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch v-model="disableDrawer" class="_formBlock">{{
				i18n.ts.disableDrawer
			}}</FormSwitch>
		</FormSection>
		<FormSection>
			<template #label></template>

			<FormRadios v-model="fontSize" class="_formBlock">
				<template #label>{{ i18n.ts.fontSize }}</template>
				<option value="-5">
					<span style="font-size: 0.6875rem">11</span>
				</option>
				<option :value="-3">
					<span style="font-size: 0.8125rem">13</span>
				</option>
				<option value="-2">
					<span style="font-size: 0.875rem">14</span>
				</option>
				<option value="-1">
					<span style="font-size: 0.9375rem">15</span>
				</option>
				<option value="null">
					<span style="font-size: 1rem">16</span>
				</option>
				<option value="1">
					<span style="font-size: 1.0625rem">17</span>
				</option>
				<option value="2">
					<span style="font-size: 1.125rem">18</span>
				</option>
				<option value="3">
					<span style="font-size: 1.1875rem">19</span>
				</option>
				<option value="5">
					<span style="font-size: 1.3125rem">21</span>
				</option>
			</FormRadios>

			<FormRadios v-model="avatarSize" class="_formBlock">
				<template #label
					>{{ i18n.ts.avatarSize
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></template
				>
				<option value="-2">極小</option>
				<option value="-1">小</option>
				<option value="null">中</option>
				<option value="1">大</option>
				<option value="2">特大</option>
				<option value="-3">豆粒</option>
				<option value="-4">非表示</option>
				<option value="f-1">固定（小）</option>
				<option value="f">固定（中）</option>
				<option value="f1">固定（大）</option>
			</FormRadios>
		</FormSection>

		<FormSection>
			<template #label>{{ i18n.ts.showColor }}</template>
			<FormSwitch v-model="showVisibilityColor">{{
				i18n.ts.showVisibilityColor
			}}</FormSwitch>
			<MkColorInput 
				v-if="showVisibilityColor"
				style="margin-top: 1.2em"
				v-model="publicColor"
			>
				<template #label>{{ i18n.ts._visibility.public }}</template>
			</MkColorInput>
			<MkColorInput v-if="showVisibilityColor" v-model="localOnlyColor">
				<template #label>{{ i18n.ts._visibility.localAndFollower }}</template>
			</MkColorInput>
			<MkColorInput v-if="showVisibilityColor" v-model="homeColor">
				<template #label>{{ i18n.ts._visibility.home }}</template>
			</MkColorInput>
			<MkColorInput v-if="showVisibilityColor" v-model="followerColor">
				<template #label>{{ i18n.ts._visibility.followers }}</template>
			</MkColorInput>
			<MkColorInput v-if="showVisibilityColor" v-model="specifiedColor">
				<template #label>{{ i18n.ts._visibility.specified }}</template>
			</MkColorInput>
			<MkColorInput
				v-if="showVisibilityColor"
				style="margin-bottom: 1.2em"
				v-model="circleColor"
			>
				<template #label>{{ i18n.ts._visibility.circleOnly }}</template>
			</MkColorInput>
			<FormButton
				v-if="showVisibilityColor"
				inline
				danger
				@click="setDefault"
				><i class="ph-arrow-counter-clockwise ph-bold ph-lg"></i>
				{{ i18n.ts.default }}</FormButton
			>
		</FormSection>

		<FormSelect v-model="instanceTicker" class="_formBlock">
			<template #label>{{ i18n.ts.instanceTicker }}</template>
			<option value="none">{{ i18n.ts._instanceTicker.none }}</option>
			<option value="remote">{{ i18n.ts._instanceTicker.remote }}</option>
			<option value="always">{{ i18n.ts._instanceTicker.always }}</option>
		</FormSelect>

		<FormSwitch v-model="tickerShowName" class="_formBlock"
			>{{ i18n.ts.tickerShowName
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span></FormSwitch
		>
		<FormSwitch v-model="tickerShowFavicon" class="_formBlock"
			>{{ i18n.ts.tickerShowFavicon
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span></FormSwitch
		>
		<FormSwitch v-model="tickerShowIcon" class="_formBlock"
			>{{ i18n.ts.tickerShowIcon
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span></FormSwitch
		>

		<FormSwitch
			v-if="developer"
			v-model="developerTicker"
			class="_formBlock"
			>{{ i18n.ts.developerTicker
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span></FormSwitch
		>

		<FormLink to="/settings/custom-css" class="_formBlock"
			><template #icon><i class="ph-code ph-bold ph-lg"></i></template
			>{{ i18n.ts.customCss }}</FormLink
		>
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
import MkColorInput from "@/components/MkColorInput.vue";
import MkLink from "@/components/MkLink.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { deviceKind } from "@/scripts/device-kind";
import { fontList } from "@/scripts/font";

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
const fontSize = ref(localStorage.getItem("fontSize"));
const avatarSize = ref(localStorage.getItem("avatarSize"));
const useSystemFont = ref(localStorage.getItem("useSystemFont") != null);
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
const disableShowingAnimatedImages = computed(
	defaultStore.makeGetterSetter("disableShowingAnimatedImages")
);
const showRelationMark = computed(
	defaultStore.makeGetterSetter("showRelationMark")
);
const loadRawImages = computed(defaultStore.makeGetterSetter("loadRawImages"));
const loadOriginalImages = computed(defaultStore.makeGetterSetter("loadOriginalImages"));
const instanceTicker = computed(
	defaultStore.makeGetterSetter("instanceTicker")
);
const tickerShowName = computed(
	defaultStore.makeGetterSetter("tickerShowName")
);
const tickerShowFavicon = computed(
	defaultStore.makeGetterSetter("tickerShowFavicon")
);
const tickerShowIcon = computed(
	defaultStore.makeGetterSetter("tickerShowIcon")
);
const seperateRenoteQuote = computed(
	defaultStore.makeGetterSetter("seperateRenoteQuote")
);
const squareAvatars = computed(defaultStore.makeGetterSetter("squareAvatars"));
const developerTicker = computed(
	defaultStore.makeGetterSetter("developerTicker")
);
const reactionShowBig = $computed(
	defaultStore.makeGetterSetter("reactionShowBig")
);
const reactionShowUsername = $computed(
	defaultStore.makeGetterSetter("reactionShowUsername")
);
const reactionShowShort = $computed(
	defaultStore.makeGetterSetter("reactionShowShort")
);
const customFont = $computed(defaultStore.makeGetterSetter("customFont"));
const randomCustomFont = $computed(
	defaultStore.makeGetterSetter("randomCustomFont")
);
const includesRandomEsenapaj = $computed(
	defaultStore.makeGetterSetter("includesRandomEsenapaj")
);
const thumbnailCover = $computed(
	defaultStore.makeGetterSetter("thumbnailCover")
);
const hiddenHeaderIcon = $computed(
	defaultStore.makeGetterSetter("hiddenHeaderIcon")
);
const alwaysXExpand = $computed(defaultStore.makeGetterSetter("alwaysXExpand"));
const compactGrid = $computed(defaultStore.makeGetterSetter("compactGrid"));
const compactGridUrl = $computed(
	defaultStore.makeGetterSetter("compactGridUrl")
);

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

const showVisibilityColor = computed(
	defaultStore.makeGetterSetter("showVisibilityColor")
);
const homeColor = computed(defaultStore.makeGetterSetter("homeColor"));
const followerColor = computed(defaultStore.makeGetterSetter("followerColor"));
const specifiedColor = computed(
	defaultStore.makeGetterSetter("specifiedColor")
);
const circleColor = computed(defaultStore.makeGetterSetter("circleColor"));
const localOnlyColor = computed(
	defaultStore.makeGetterSetter("localOnlyColor")
);
const publicColor = computed(
	defaultStore.makeGetterSetter("publicColor")
);

function hexToRgb(hex) {
	if (/^#[0-9A-Fa-f]{6}$/i.test(hex) || /^#[0-9A-Fa-f]{8}$/i.test(hex)) {
		// 16進数のカラーコードから "#" を除去
		hex = hex.replace(/^#/, "");

		// 16進数をRGBに変換
		const r = Number.parseInt(hex.substring(0, 2), 16);
		const g = Number.parseInt(hex.substring(2, 4), 16);
		const b = Number.parseInt(hex.substring(4, 6), 16);
		let a = 32;
		if (hex.length >= 8) {
			a = Number.parseInt(hex.substring(6, 8), 16);
		}

		return `rgba(${r},${g},${b},${a/255})`;
	}
	return hex;
}

document.documentElement.style.setProperty(
	"--homeColor",
	hexToRgb(homeColor.value)
);
document.documentElement.style.setProperty(
	"--followerColor",
	hexToRgb(followerColor.value)
);
document.documentElement.style.setProperty(
	"--specifiedColor",
	hexToRgb(specifiedColor.value)
);
document.documentElement.style.setProperty(
	"--circleColor",
	hexToRgb(circleColor.value)
);
document.documentElement.style.setProperty(
	"--localOnlyColor",
	hexToRgb(localOnlyColor.value)
);
document.documentElement.style.setProperty(
	"--publicColor",
	hexToRgb(publicColor.value)
);
watch(
	[homeColor, specifiedColor, followerColor, circleColor, localOnlyColor, publicColor],
	() => {
		document.documentElement.style.setProperty(
			"--homeColor",
			hexToRgb(homeColor.value)
		);
		document.documentElement.style.setProperty(
			"--followerColor",
			hexToRgb(followerColor.value)
		);
		document.documentElement.style.setProperty(
			"--specifiedColor",
			hexToRgb(specifiedColor.value)
		);
		document.documentElement.style.setProperty(
			"--circleColor",
			hexToRgb(circleColor.value)
		);
		document.documentElement.style.setProperty(
			"--localOnlyColor",
			hexToRgb(localOnlyColor.value)
		);
		document.documentElement.style.setProperty(
			"--publicColor",
			hexToRgb(publicColor.value)
		);
	}
);

async function setDefault() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: `${i18n.ts.resetAreYouSure}`,
	});
	if (canceled) return;

	homeColor.value = defaultStore.def.homeColor.default;
	followerColor.value = defaultStore.def.followerColor.default;
	specifiedColor.value = defaultStore.def.specifiedColor.default;
	circleColor.value = defaultStore.def.circleColor.default;
	localOnlyColor.value = defaultStore.def.localOnlyColor.default;
}

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
		fontSize,
		avatarSize,
		useSystemFont,
		squareAvatars,
		showGapBetweenNotesInTimeline,
		instanceTicker,
		seperateRenoteQuote,
		developerTicker,
	],
	async () => {
		await reloadAsk();
	}
);

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.appearance,
	icon: "ph-shapes ph-bold ph-lg",
});
</script>
