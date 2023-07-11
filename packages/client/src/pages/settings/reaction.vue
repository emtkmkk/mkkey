<template>
	<div class="_formRoot">
		<FormSwitch v-model="enableEmojiReactions" class="_formBlock">
			{{ i18n.ts.enableEmojiReactions }}
		</FormSwitch>
		<FormSwitch v-if="!enableEmojiReactions" v-model="showEmojiButton" class="_formBlock">
			{{ i18n.ts.showEmojiButton }}
		</FormSwitch>
		<div v-if="!enableEmojiReactions">
			<FormSwitch
				v-model="showEmojisInReactionNotifications"
				class="_formBlock"
			>
				{{ i18n.ts.showEmojisInReactionNotifications }}
			</FormSwitch>
		</div>

		<div>
			<FromSlot class="_formBlock" v-if="!hiddenReactionDeckAndRecent">
				<template #label>{{
					i18n.ts.reactionSettingDescription
				}}</template>
				<div v-panel style="border-radius: 6px">
					<XDraggable
						v-model="reactions"
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
								<MkEmoji :emoji="element" :normal="true" />
							</button>
						</template>
						<template #footer>
							<button class="_button add" @click="chooseEmoji">
								<i class="ph-plus ph-bold ph-lg"></i>
							</button>
						</template>
					</XDraggable>
				</div>
				<template #caption
					>{{ i18n.ts.reactionSettingDescription2 }}
					<button class="_textButton" @click="preview">
						{{ i18n.ts.preview }}
					</button></template
				>
			</FromSlot>
			<FormSwitch
				v-model="reactionAutoFocusSearchBar"
				class="_formBlock"
			>
				{{ i18n.ts.reactionAutoFocusSearchBar }}
			</FormSwitch>
			<FormSwitch
				v-model="hiddenReactionDeckAndRecent"
				class="_formBlock"
			>
				{{ i18n.ts.hiddenReactionDeckAndRecent }}
			</FormSwitch>
			<FormSwitch
				v-model="japanCategory"
				class="_formBlock"
			>
				{{ i18n.ts.japanCategory }}
			</FormSwitch>
			
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
			
			<FormSection>
				<FormRadios
					v-model="favButtonReaction"
					class="_formBlock"
				>
					<template #label>{{
						i18n.ts.defaultReactionUser
					}}</template>
					<option value="">
						{{
							i18n.ts.default
						}}
					</option>
					<option value="⭐">
						<MkEmoji
							class="emoji"
							emoji="⭐"
							style="height: 1.5em"
						/>
					</option>
					<option value="👍">
						<MkEmoji
							class="emoji"
							emoji="👍"
							style="height: 1.5em"
						/>
					</option>
					<option value="❤️">
						<MkEmoji
							class="emoji"
							emoji="❤️"
							style="height: 1.5em"
						/>
					</option>
					<option value="picker">
						{{
							i18n.ts.picker
						}}
					</option>
					<option value="custom">
						<FormInput
							v-model="favButtonReactionCustom"
							class="_formBlock"
							:small="true"
							:placeholder="`:絵文字名:`"
							style="margin: 0 0 !important"
						/>
					</option>
					<option value="favorite">
						{{
							i18n.ts.favorite
						}}
					</option>
					<option value="hidden">
						{{
							i18n.ts.hidden
						}}
					</option>
				</FormRadios>
			</FormSection>
			
			<FormRadios v-model="reactionPickerSize" class="_formBlock">
				<template #label>{{ i18n.ts.size }}</template>
				<option :value="-6">{{ i18n.ts.small }}-7</option>
				<option :value="-5">{{ i18n.ts.small }}-6</option>
				<option :value="-4">{{ i18n.ts.small }}-5</option>
				<option :value="-3">{{ i18n.ts.small }}-4</option>
				<option :value="-2">{{ i18n.ts.small }}-3</option>
				<option :value="-1">{{ i18n.ts.small }}-2</option>
				<option :value="0">{{ i18n.ts.small }}-1</option>
				<option :value="1">{{ i18n.ts.small }}</option>
				<option :value="2">{{ i18n.ts.medium }}</option>
				<option :value="3">{{ i18n.ts.large }}</option>
				<option :value="4">{{ i18n.ts.large }}+1</option>
				<option :value="5">{{ i18n.ts.large }}+2</option>
				<option :value="6">{{ i18n.ts.large }}+3</option>
				<option :value="7">{{ i18n.ts.large }}+4</option>
				<option :value="8">{{ i18n.ts.large }}+5</option>
				<option :value="9">{{ i18n.ts.large }}+6</option>
			</FormRadios>
			<FormRadios v-model="reactionPickerWidth" class="_formBlock">
				<template #label>{{ i18n.ts.numberOfColumn }}</template>
				<option :value="-3">1</option>
				<option :value="-2">2</option>
				<option :value="-1">3</option>
				<option :value="0">4</option>
				<option :value="1">5</option>
				<option :value="2">6</option>
				<option :value="3">7</option>
				<option :value="4">8</option>
				<option :value="5">9</option>
				<option :value="6">10</option>
				<option :value="7">11</option>
				<option :value="8">12</option>
				<option :value="9">13</option>
				<option :value="10">14</option>
				<option :value="11">15</option>
				<option :value="12">16</option>
				<option :value="13">17</option>
				<option :value="14">18</option>
				<option :value="15">19</option>
				<option :value="16">20</option>
			</FormRadios>
			<FormRadios v-model="reactionPickerHeight" class="_formBlock">
				<template #label>{{ i18n.ts.height }}</template>
				<option :value="1">{{ i18n.ts.small }}</option>
				<option :value="2">{{ i18n.ts.medium }}</option>
				<option :value="3">{{ i18n.ts.large }}</option>
				<option :value="4">{{ i18n.ts.large }}+1</option>
				<option :value="5">{{ i18n.ts.large }}+2</option>
				<option :value="6">{{ i18n.ts.large }}+3</option>
				<option :value="7">{{ i18n.ts.large }}+4</option>
				<option :value="8">{{ i18n.ts.large }}+5</option>
				<option :value="9">{{ i18n.ts.large }}+6</option>
				<option :value="10">Auto(90%)</option>
			</FormRadios>

			<FormSwitch
				v-model="reactionPickerUseDrawerForMobile"
				class="_formBlock"
			>
				{{ i18n.ts.useDrawerReactionPickerForMobile }}
				<template #caption>{{ i18n.ts.needReloadToApply }}</template>
			</FormSwitch>

			<FormSection>
				<div style="display: flex; gap: var(--margin); flex-wrap: wrap">
					<FormButton inline @click="preview"
						><i class="ph-eye ph-bold ph-lg"></i>
						{{ i18n.ts.preview }}</FormButton
					>
					<FormButton inline danger @click="setDefault"
						><i
							class="ph-arrow-counter-clockwise ph-bold ph-lg"
						></i>
						 {{ i18n.ts.default }}</FormButton
				>
				</div>
			</FormSection>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, watch } from "vue";
import XDraggable from "vuedraggable";
import FormInput from "@/components/form/input.vue";
import FormSelect from "@/components/form/select.vue";
import FormRadios from "@/components/form/radios.vue";
import FromSlot from "@/components/form/slot.vue";
import FormButton from "@/components/MkButton.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deepClone } from "@/scripts/clone";
import { unisonReload } from "@/scripts/unison-reload";
import { deviceKind } from "@/scripts/device-kind";

const MOBILE_THRESHOLD = 500;

const isMobile = ref(
	deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD
);
window.addEventListener("resize", () => {
	isMobile.value =
		deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD;
});

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

let reactions = $ref(deepClone(defaultStore.state.reactions));
const hiddenReactionDeckAndRecent = $computed(
	defaultStore.makeGetterSetter("hiddenReactionDeckAndRecent")
);
const reactionPickerSize = $computed(
	defaultStore.makeGetterSetter("reactionPickerSize")
);
const reactionPickerWidth = $computed(
	defaultStore.makeGetterSetter("reactionPickerWidth")
);
const reactionPickerHeight = $computed(
	defaultStore.makeGetterSetter("reactionPickerHeight")
);
const reactionPickerUseDrawerForMobile = $computed(
	defaultStore.makeGetterSetter("reactionPickerUseDrawerForMobile")
);
const enableEmojiReactions = $computed(
	defaultStore.makeGetterSetter("enableEmojiReactions")
);
const showEmojisInReactionNotifications = $computed(
	defaultStore.makeGetterSetter("showEmojisInReactionNotifications")
);
const showEmojiButton = $computed(
	defaultStore.makeGetterSetter("showEmojiButton")
);
const favButtonReaction = $computed(
	defaultStore.makeGetterSetter("favButtonReaction")
);
const favButtonReactionCustom = $computed(
	defaultStore.makeGetterSetter("favButtonReactionCustom")
);
const reactionAutoFocusSearchBar = $computed(
	defaultStore.makeGetterSetter("reactionAutoFocusSearchBar")
);
const japanCategory = $computed(
	defaultStore.makeGetterSetter("japanCategory")
);
const remoteEmojisFetch = $computed(
	defaultStore.makeGetterSetter("remoteEmojisFetch")
);

function save() {
	defaultStore.set("reactions", reactions);
}

function remove(reaction, ev: MouseEvent) {
	os.popupMenu(
		[
			{
				text: i18n.ts.remove,
				action: () => {
					reactions = reactions.filter((x) => x !== reaction);
				},
			},
		],
		ev.currentTarget ?? ev.target
	);
}

function preview(ev: MouseEvent) {
	os.popup(
		defineAsyncComponent(
			() => import("@/components/MkEmojiPickerDialog.vue")
		),
		{
			asReactionPicker: true,
			src: ev.currentTarget ?? ev.target,
		},
		{},
		"closed"
	);
}

async function setDefault() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.ts.resetAreYouSure,
	});
	if (canceled) return;

	reactions = deepClone(defaultStore.def.reactions.default);
}

function chooseEmoji(ev: MouseEvent) {
	os.pickEmoji(ev.currentTarget ?? ev.target, {
		showPinned: false,
		asReactionPicker: true,
	}).then((emoji) => {
		if (!reactions.includes(emoji)) {
			reactions.push(emoji);
		}
	});
}

watch(
	$$(reactions),
	() => {
		save();
	},
	{
		deep: true,
	}
);

watch([
	enableEmojiReactions,
	remoteEmojisFetch,
	],
	async () => {
		await reloadAsk();
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.reaction,
	icon: "ph-smiley ph-bold ph-lg",
	action: {
		icon: "ph-eye ph-bold ph-lg",
		handler: preview,
	},
});
</script>

<style lang="scss" scoped>
.zoaiodol {
	padding: 12px;
	font-size: 1.1em;

	> .item {
		display: inline-block;
		padding: 8px;
		cursor: move;
	}

	> .add {
		display: inline-block;
		padding: 8px;
	}
}
</style>
