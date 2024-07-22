<template>
	<div class="_formRoot">
		<FormSection>
			<template #label
				>{{ i18n.ts.power
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch v-model="powerMode" class="_formBlock"
				>{{ i18n.ts.powerMode
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormRange
				v-if="powerMode"
				v-model="powerModeParticleCount"
				:min="0"
				:max="powerModeParticleCount >= 20 ? (Math.floor(powerModeParticleCount / 10) + 1) * 10 : 20"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeParticleCount }}</template
				>
			</FormRange>
			<FormRange
				v-if="powerMode"
				v-model="powerModeParticleSize"
				:min="0"
				:max="powerModeParticleSize >= 6 ? (Math.floor(powerModeParticleSize / 3) + 1) * 3 : 6"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeParticleSize }}</template
				>
			</FormRange>
			<FormRange
				v-if="powerMode"
				v-model="powerModeParticleX"
				:min="powerModeParticleX <= -10 ? (Math.floor(powerModeParticleX / -5) + 1) * -5 : -10"
				:max="powerModeParticleX >= 10 ? (Math.floor(powerModeParticleX / 5) + 1) * 5 : 10"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeParticleX }}</template
				>
			</FormRange>
			<FormRange
				v-if="powerMode"
				v-model="powerModeParticleY"
				:min="powerModeParticleY <= -10 ? (Math.floor(powerModeParticleY / -5) + 1) * -5 : -10"
				:max="powerModeParticleY >= 10 ? (Math.floor(powerModeParticleY / 5) + 1) * 5 : 10"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeParticleY }}</template
				>
			</FormRange>
			<FormRange
				v-if="powerMode"
				v-model="powerModeParticleSpreadX"
				:min="0"
				:max="powerModeParticleSpreadX >= 20 ? (Math.floor(powerModeParticleSpreadX / 10) + 1) * 10 : 20"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeParticleSpreadX }}</template
				>
			</FormRange>
			<FormRange
				v-if="powerMode"
				v-model="powerModeParticleSpreadY"
				:min="0"
				:max="powerModeParticleSpreadY >= 20 ? (Math.floor(powerModeParticleSpreadY / 10) + 1) * 10 : 20"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeParticleSpreadY }}</template
				>
			</FormRange>
			<FormRange
				v-if="powerMode"
				v-model="powerModeParticleGravity"
				:min="0"
				:max="powerModeParticleGravity >= 60 ? (Math.floor(powerModeParticleGravity / 30) + 1) * 30 : 60"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeParticleGravity }}</template
				>
			</FormRange>
			<FormSwitch
				v-if="powerMode"
				v-model="powerModeColorful"
				class="_formBlock"
				>{{ i18n.ts.powerModeColorful
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch
				v-if="powerMode"
				v-model="powerModeSuperColorful"
				class="_formBlock"
				>{{ i18n.ts.powerModeSuperColorful
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch
				v-if="powerMode"
				v-model="powerModeNoShake"
				class="_formBlock"
				>{{ i18n.ts.powerModeNoShake
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormRange
				v-if="powerMode && !powerModeNoShake"
				v-model="powerModeShakePower"
				:min="0"
				:max="powerModeShakePower >= 10 ? (Math.floor(powerModeShakePower / 5) + 1) * 5 : 10"
				:step="1"
				easing
				class="_formBlock"
			>
				<template #label
					>{{ i18n.ts.powerModeShakePower }}</template
				>
			</FormRange>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.item
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch
				v-model="disableNyaise"
				class="_formBlock"
				@update:modelValue="update()"
				>{{ i18n.ts.disableNyaise
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span
				><template #caption>{{
					i18n.ts.disableNyaiseDescription
				}}</template></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.morse
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch v-model="enableMorseDecode" class="_formBlock"
				>{{ i18n.ts.enableMorseDecode
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.forkids
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch v-model="excludeSimo" class="_formBlock"
				>{{ i18n.ts.excludeSimo
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span
				><template #caption>{{
					i18n.ts.excludeSimoDescription
				}}</template></FormSwitch
			>
			<FormSwitch v-model="excludeNSFW" class="_formBlock"
				>{{ i18n.ts.excludeNSFW
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch
				:disabled="!excludeNSFW"
				v-model="excludeNotFollowNSFW"
				class="_formBlock"
				>{{ i18n.ts.excludeNotFollowNSFW
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label></template>
			<FormSwitch v-model="postStartSleep" class="_formBlock"
				>{{ i18n.ts.postStartSleep
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.emojiReplace
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch v-model="enableEmojiReplace" class="_formBlock"
				>{{ i18n.ts.enableEmojiReplace
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>

			<div
				v-panel
				v-if="enableEmojiReplace"
				style="border-radius: 0.375rem"
			>
				<XDraggable
					v-model="allEmojiReplace"
					class="zoaiodol"
					:item-key="(item) => item"
					animation="150"
					delay="100"
					delay-on-touch-only="true"
				>
					<template #item="{ element }">
						<button
							class="_button item"
							@click="remove(element, $event)"
						>
							<MkEmoji
								:emoji="element"
								:normal="true"
								:nofallback="true"
								noreplace
							/>
						</button>
					</template>
					<template #footer>
						<button class="_button add" @click="chooseEmoji">
							<i class="ph-plus ph-bold ph-lg"></i>
						</button>
					</template>
				</XDraggable>
			</div>
			<FormButton
				v-if="enableEmojiReplace"
				inline
				danger
				@click="setEmpty"
				><i class="ph-trash ph-bold ph-lg"></i>
				{{ i18n.ts.allDelete }}</FormButton
			>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import XDraggable from "vuedraggable";
import FormButton from "@/components/MkButton.vue";
import FormLink from "@/components/form/link.vue";
import FormRange from "@/components/form/range.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { deviceKind } from "@/scripts/device-kind";
import { deepClone } from "@/scripts/clone";

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

const powerMode = computed(defaultStore.makeGetterSetter("powerMode"));
const powerModeParticleCount = computed(defaultStore.makeGetterSetter("powerModeParticleCount"));
const powerModeColorful = computed(
	defaultStore.makeGetterSetter("powerModeColorful")
);
const powerModeSuperColorful = computed(
	defaultStore.makeGetterSetter("powerModeSuperColorful")
);
const powerModeParticleX = computed(defaultStore.makeGetterSetter("powerModeParticleX"));
const powerModeParticleY = computed(defaultStore.makeGetterSetter("powerModeParticleY"));
const powerModeParticleSpreadX = computed(defaultStore.makeGetterSetter("powerModeParticleSpreadX"));
const powerModeParticleSpreadY = computed(defaultStore.makeGetterSetter("powerModeParticleSpreadY"));
const powerModeParticleGravity = computed(defaultStore.makeGetterSetter("powerModeParticleGravity"));
const powerModeParticleSize = computed(defaultStore.makeGetterSetter("powerModeParticleSize"));
const powerModeShakePower = computed(defaultStore.makeGetterSetter("powerModeShakePower"));
const powerModeNoShake = computed(
	defaultStore.makeGetterSetter("powerModeNoShake")
);
const enableMorseDecode = computed(
	defaultStore.makeGetterSetter("enableMorseDecode")
);
const excludeSimo = computed(defaultStore.makeGetterSetter("excludeSimo"));
const excludeNSFW = computed(defaultStore.makeGetterSetter("excludeNSFW"));
const excludeNotFollowNSFW = computed(
	defaultStore.makeGetterSetter("excludeNotFollowNSFW")
);
const excludeSensitiveEmoji = computed(
	defaultStore.makeGetterSetter("excludeSensitiveEmoji")
);
const postStartSleep = computed(
	defaultStore.makeGetterSetter("postStartSleep")
);
let allEmojiReplace = $ref(deepClone(defaultStore.state.allEmojiReplace));
const enableEmojiReplace = computed(
	defaultStore.makeGetterSetter("enableEmojiReplace")
);
let disableNyaise = $ref($i.disableNyaise);

function chooseEmoji(ev: MouseEvent) {
	os.pickEmoji(ev.currentTarget ?? ev.target, {
		showPinned: false,
		asReactionPicker: true,
	}).then((emoji) => {
		if (!allEmojiReplace.includes(emoji)) {
			allEmojiReplace.push(emoji);
		}
	});
}

function remove(reaction, ev: MouseEvent) {
	os.popupMenu(
		[
			{
				text: reaction.replace(/@(\S+)$/, "").replaceAll(":", ""),
				type: "label",
			},
			reaction.includes("@")
				? {
						text: reaction
							.replace(/^(\S+)@/, "@")
							.replaceAll(":", ""),
						type: "label",
				  }
				: undefined,
			{
				text: i18n.ts.remove,
				action: () => {
					allEmojiReplace = allEmojiReplace.filter(
						(x) => x !== reaction
					);
				},
			},
		].filter((x) => x !== undefined),
		ev.currentTarget ?? ev.target
	);
}

watch(
	[$$(allEmojiReplace)],
	() => {
		save();
	},
	{
		deep: true,
	}
);

function save() {
	defaultStore.set("allEmojiReplace", allEmojiReplace);
}

function update() {
	os.api("i/update", {
		disableNyaise: !!disableNyaise,
	});
}

async function setEmpty() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.ts.deleteReactionAreYouSure,
	});
	if (canceled) return;

	allEmojiReplace = [];
}

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

watch([powerMode], async () => {
	await reloadAsk();
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.funSetting,
	icon: "ph-confetti ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.zoaiodol {
	padding: 0.75rem;
	font-size: 1.1em;

	> .item {
		display: inline-block;
		padding: 0.5rem;
		cursor: move;
	}

	> .add {
		display: inline-block;
		padding: 0.5rem;
	}
}
</style>
