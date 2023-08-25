<template>
	<div class="_formRoot">
		<FormSwitch v-model="enableEmojiReactions" class="_formBlock">
			{{ i18n.ts.enableEmojiReactions }}
		</FormSwitch>
		<FormSwitch v-if="!enableEmojiReactions" v-model="showEmojiButton" class="_formBlock">
			{{ i18n.ts.showEmojiButton }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
		</FormSwitch>
		<div v-if="!enableEmojiReactions">
			<FormSwitch
				v-model="showEmojisInRectionNotifications"
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
				<MkTab v-model="tab" class="_formBlock">
					<option value="reactions">{{ !reactionsFolderName ? "1" : reactionsFolderName.slice(0,3) + (reactionsFolderName?.length > 3 ? "…" : "") }}</option>
					<option value="reactions2">{{ !reactionsFolderName2 ? "2" : reactionsFolderName2.slice(0,3) + (reactionsFolderName2?.length > 3 ? "…" : "") }}</option>
					<option value="reactions3">{{ !reactionsFolderName3 ? "3" : reactionsFolderName3.slice(0,3) + (reactionsFolderName3?.length > 3 ? "…" : "") }}</option>
					<option value="reactions4">{{ !reactionsFolderName4 ? "4" : reactionsFolderName4.slice(0,3) + (reactionsFolderName4?.length > 3 ? "…" : "") }}</option>
					<option value="reactions5">{{ !reactionsFolderName5 ? "5" : reactionsFolderName5.slice(0,3) + (reactionsFolderName5?.length > 3 ? "…" : "") }}</option>
				</MkTab>
				<div v-panel v-if="tab === 'reactions'" style="border-radius: 6px">
					<FormInput
						v-model="reactionsFolderName"
						class="_formBlock"
						:small="true"
						:placeholder="`フォルダ名 : 1`"
						v-if="((reactions2?.length ?? 0) + (reactions3?.length ?? 0) + (reactions4?.length ?? 0) + (reactions5?.length ?? 0)) !== 0"
						style="margin: 0 0 !important"
					/>
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
								<MkEmoji :emoji="element" :normal="true" :nofallback="true" />
							</button>
						</template>
						<template #footer>
							<button class="_button add" @click="chooseEmoji">
								<i class="ph-plus ph-bold ph-lg"></i>
							</button>
						</template>
					</XDraggable>
				</div>
				<div v-panel v-if="tab === 'reactions2'" style="border-radius: 6px">
					<FormInput
						v-model="reactionsFolderName2"
						class="_formBlock"
						:small="true"
						:placeholder="`フォルダ名 : 2`"
						style="margin: 0 0 !important"
					/>
					<XDraggable
						v-model="reactions2"
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
								<MkEmoji :emoji="element" :normal="true" :nofallback="true" />
							</button>
						</template>
						<template #footer>
							<button class="_button add" @click="chooseEmoji">
								<i class="ph-plus ph-bold ph-lg"></i>
							</button>
						</template>
					</XDraggable>
				</div>
				<div v-panel v-if="tab === 'reactions3'" style="border-radius: 6px">
					<FormInput
						v-model="reactionsFolderName3"
						class="_formBlock"
						:small="true"
						:placeholder="`フォルダ名 : 3`"
						style="margin: 0 0 !important"
					/>
					<XDraggable
						v-model="reactions3"
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
								<MkEmoji :emoji="element" :normal="true" :nofallback="true" />
							</button>
						</template>
						<template #footer>
							<button class="_button add" @click="chooseEmoji">
								<i class="ph-plus ph-bold ph-lg"></i>
							</button>
						</template>
					</XDraggable>
				</div>
				<div v-panel v-if="tab === 'reactions4'" style="border-radius: 6px">
					<FormInput
						v-model="reactionsFolderName4"
						class="_formBlock"
						:small="true"
						:placeholder="`フォルダ名 : 4`"
						style="margin: 0 0 !important"
					/>
					<XDraggable
						v-model="reactions4"
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
								<MkEmoji :emoji="element" :normal="true" :nofallback="true" />
							</button>
						</template>
						<template #footer>
							<button class="_button add" @click="chooseEmoji">
								<i class="ph-plus ph-bold ph-lg"></i>
							</button>
						</template>
					</XDraggable>
				</div>
				<div v-panel v-if="tab === 'reactions5'" style="border-radius: 6px">
					<FormInput
						v-model="reactionsFolderName5"
						class="_formBlock"
						:small="true"
						:placeholder="`フォルダ名 : 5`"
						style="margin: 0 0 !important"
					/>
					<XDraggable
						v-model="reactions5"
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
								<MkEmoji :emoji="element" :normal="true" :nofallback="true" />
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
				<FormSwitch
					v-model="reactionsDefaultOpen"
					v-if="tab === 'reactions' && ((reactions2?.length ?? 0) + (reactions3?.length ?? 0) + (reactions4?.length ?? 0) + (reactions5?.length ?? 0)) !== 0"
					class="_formBlock"
				>
					{{ i18n.ts.reactionsDefaultOpen }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
				</FormSwitch>
				<FormSwitch
					v-model="reactions2DefaultOpen"
					v-if="tab === 'reactions2'"
					class="_formBlock"
				>
					{{ i18n.ts.reactionsDefaultOpen }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
				</FormSwitch>
				<FormSwitch
					v-model="reactions3DefaultOpen"
					v-if="tab === 'reactions3'"
					class="_formBlock"
				>
					{{ i18n.ts.reactionsDefaultOpen }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
				</FormSwitch>
				<FormSwitch
					v-model="reactions4DefaultOpen"
					v-if="tab === 'reactions4'"
					class="_formBlock"
				>
					{{ i18n.ts.reactionsDefaultOpen }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
				</FormSwitch>
				<FormSwitch
					v-model="reactions5DefaultOpen"
					v-if="tab === 'reactions5'"
					class="_formBlock"
				>
					{{ i18n.ts.reactionsDefaultOpen }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
				</FormSwitch>
			</FromSlot>
			<FormSwitch
				v-model="reactionAutoFocusSearchBar"
				class="_formBlock"
			>
				{{ i18n.ts.reactionAutoFocusSearchBar }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch
				v-model="doubleTapReaction"
				class="_formBlock"
			>
				{{ i18n.ts.doubleTapReaction }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch
				v-model="recentlyUsedDefaultOpen"
				class="_formBlock"
				v-if="((reactions2?.length ?? 0) + (reactions3?.length ?? 0) + (reactions4?.length ?? 0) + (reactions5?.length ?? 0)) !== 0 && !hiddenRecent && !hiddenReactionDeckAndRecent"
			>
				{{ i18n.ts.recentlyUsedDefaultOpen }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch
				v-model="hiddenRecent"
				class="_formBlock"
				v-if="!hiddenReactionDeckAndRecent"
			>
				{{ i18n.ts.hiddenRecent }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch
				v-model="hiddenReactionDeckAndRecent"
				class="_formBlock"
				v-if="!hiddenRecent"
			>
				{{ i18n.ts.hiddenReactionDeckAndRecent }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch
				v-model="japanCategory"
				class="_formBlock"
			>
				{{ i18n.ts.japanCategory }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch
				v-model="enableInstanceEmojiSearch"
				class="_formBlock"
			>
				{{ i18n.ts.enableInstanceEmojiSearch }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch
				v-model="disableAllIncludesSearch"
				class="_formBlock"
			>
				{{ i18n.ts.disableAllIncludesSearch }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			
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
			
			<FormSection>
				<FormRadios
					v-model="favButtonReaction"
					class="_formBlock"
				>
					<template #label>{{
						i18n.ts.defaultReactionUser
					}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
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
					<FormButton inline danger @click="setEmpty"
						><i
							class="ph-trash ph-bold ph-lg"
						></i>
						 {{ i18n.ts.allDelete }}</FormButton
					>
				</div>
			</FormSection>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, unref, onMounted, defineAsyncComponent, watch } from "vue";
import XDraggable from "vuedraggable";
import FormInput from "@/components/form/input.vue";
import FormSelect from "@/components/form/select.vue";
import FormRadios from "@/components/form/radios.vue";
import FromSlot from "@/components/form/slot.vue";
import FormButton from "@/components/MkButton.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import MkTab from "@/components/MkTab.vue";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deepClone } from "@/scripts/clone";
import { unisonReload } from "@/scripts/unison-reload";
import { deviceKind } from "@/scripts/device-kind";
import { instance } from "@/instance";
import { $i } from "@/account";

const MOBILE_THRESHOLD = 500;

const isMobile = $ref(
	deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD
);
window.addEventListener("resize", () => {
	isMobile =
		deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD;
});

const tab = $ref("reactions");

const showMkkeySettingTips = $computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

let reactions = $ref(deepClone(defaultStore.state.reactions));
let reactions2 = $ref(deepClone(defaultStore.state.reactions2));
let reactions3 = $ref(deepClone(defaultStore.state.reactions3));
let reactions4 = $ref(deepClone(defaultStore.state.reactions4));
let reactions5 = $ref(deepClone(defaultStore.state.reactions5));
const reactionsFolderName = $computed(
	defaultStore.makeGetterSetter("reactionsFolderName")
);
const reactionsFolderName2 = $computed(
	defaultStore.makeGetterSetter("reactionsFolderName2")
);
const reactionsFolderName3 = $computed(
	defaultStore.makeGetterSetter("reactionsFolderName3")
);
const reactionsFolderName4 = $computed(
	defaultStore.makeGetterSetter("reactionsFolderName4")
);
const reactionsFolderName5 = $computed(
	defaultStore.makeGetterSetter("reactionsFolderName5")
);
const reactionsDefaultOpen = $computed(
	defaultStore.makeGetterSetter("reactionsDefaultOpen")
);
const reactions2DefaultOpen = $computed(
	defaultStore.makeGetterSetter("reactions2DefaultOpen")
);
const reactions3DefaultOpen = $computed(
	defaultStore.makeGetterSetter("reactions3DefaultOpen")
);
const reactions4DefaultOpen = $computed(
	defaultStore.makeGetterSetter("reactions4DefaultOpen")
);
const reactions5DefaultOpen = $computed(
	defaultStore.makeGetterSetter("reactions5DefaultOpen")
);
const recentlyUsedDefaultOpen = $computed(
	defaultStore.makeGetterSetter("recentlyUsedDefaultOpen")
);
const hiddenRecent = $computed(
	defaultStore.makeGetterSetter("hiddenRecent")
);
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
const doubleTapReaction = $computed(
	defaultStore.makeGetterSetter("doubleTapReaction")
);	
const customEmojis = computed(() => 
	instance.emojis
);
let allCustomEmojis = computed(() => 
	instance.allEmojis
);
const emojiStr = computed(() => 
	unref(customEmojis) ? unref(customEmojis).map((x) => ":" + x.name + ":") : undefined
);
const remoteEmojiStr = computed(() => 
	unref(allCustomEmojis) ? unref(allCustomEmojis).map((x) => ":" + x.name + "@" + x.host + ":") : undefined
);
const enableInstanceEmojiSearch = $computed(
	defaultStore.makeGetterSetter("enableInstanceEmojiSearch")
);
const disableAllIncludesSearch = $computed(
	defaultStore.makeGetterSetter("disableAllIncludesSearch")
);

const editPage = $computed(() => {
		return tab === 'reactions' 
		? reactions
		: tab === 'reactions2' 
			? reactions2
			: tab === 'reactions3' 
				? reactions3
				: tab === 'reactions4' 
					? reactions4
					: reactions5;
});

function deleteReac(reaction){
	if (tab === 'reactions') reactions = reactions.filter((x) => x !== reaction);
	if (tab === 'reactions2') reactions2 = reactions2.filter((x) => x !== reaction);
	if (tab === 'reactions3') reactions3 = reactions3.filter((x) => x !== reaction);
	if (tab === 'reactions4') reactions4 = reactions4.filter((x) => x !== reaction);
	if (tab === 'reactions5') reactions5 = reactions5.filter((x) => x !== reaction);
}

function deleteAllReac(){
	if (tab === 'reactions') reactions = [];
	if (tab === 'reactions2') reactions2 = [];
	if (tab === 'reactions3') reactions3 = [];
	if (tab === 'reactions4') reactions4 = [];
	if (tab === 'reactions5') reactions5 = [];
}

function save() {
	defaultStore.set("reactions", reactions);
	defaultStore.set("reactions2", reactions2);
	defaultStore.set("reactions3", reactions3);
	defaultStore.set("reactions4", reactions4);
	defaultStore.set("reactions5", reactions5);
}

function remove(reaction, ev: MouseEvent) {
	os.popupMenu(
		[
			{
				text: reaction.replace(/@(\S+)$/,"").replaceAll(":",""),
				type: "label",
			},
			reaction.includes("@") ? {
				text: reaction.replace(/^(\S+)@/,"@").replaceAll(":",""),
				type: "label",
			} : undefined,
			!reaction.includes("@") && !unref(emojiStr)?.includes(reaction) && unref(customEmojis).some((x) => x.aliases?.some((y) => /^\w+$/.test(y) && y === reaction.replaceAll(":",""))) ? {
				text: "代替絵文字に変換",
				action: () => {
					if (tab === 'reactions') reactions[reactions.indexOf(reaction)] = ":" + unref(customEmojis).find((x) => x.aliases?.some((y) => /^\w+$/.test(y) && y === reaction.replaceAll(":",""))).name + ":";
					if (tab === 'reactions2') reactions2[reactions2.indexOf(reaction)] = ":" + unref(customEmojis).find((x) => x.aliases?.some((y) => /^\w+$/.test(y) && y === reaction.replaceAll(":",""))).name + ":";
					if (tab === 'reactions3') reactions3[reactions3.indexOf(reaction)] = ":" + unref(customEmojis).find((x) => x.aliases?.some((y) => /^\w+$/.test(y) && y === reaction.replaceAll(":",""))).name + ":";
					if (tab === 'reactions4') reactions4[reactions4.indexOf(reaction)] = ":" + unref(customEmojis).find((x) => x.aliases?.some((y) => /^\w+$/.test(y) && y === reaction.replaceAll(":",""))).name + ":";
					if (tab === 'reactions5') reactions5[reactions5.indexOf(reaction)] = ":" + unref(customEmojis).find((x) => x.aliases?.some((y) => /^\w+$/.test(y) && y === reaction.replaceAll(":",""))).name + ":";
				},
			} : undefined,
			reaction.includes("@") && !unref(remoteEmojiStr)?.includes(reaction) && unref(emojiStr)?.includes(reaction.replace(/@(\S+)$/,":")) ? {
				text: "ローカル絵文字に変換",
				action: () => {
					if (tab === 'reactions') reactions[reactions.indexOf(reaction)] = reaction.replace(/@(\S+)$/,":");
					if (tab === 'reactions2') reactions2[reactions2.indexOf(reaction)] = reaction.replace(/@(\S+)$/,":");
					if (tab === 'reactions3') reactions3[reactions3.indexOf(reaction)] = reaction.replace(/@(\S+)$/,":");
					if (tab === 'reactions4') reactions4[reactions4.indexOf(reaction)] = reaction.replace(/@(\S+)$/,":");
					if (tab === 'reactions5') reactions5[reactions5.indexOf(reaction)] = reaction.replace(/@(\S+)$/,":");
				},
			} : undefined,
			tab !== 'reactions' && !reactions.includes(reaction) ? {
				text: (reactionsFolderName || "1")?.slice(0,6) + (reactionsFolderName?.length > 6 ? "…" : "") + "に移動",
				action: () => {
					deleteReac(reaction);
					reactions.push(reaction);
				},
			} : undefined,
			tab !== 'reactions2' && !reactions2.includes(reaction) ? {
				text: (reactionsFolderName2 || "2")?.slice(0,6) + (reactionsFolderName2?.length > 6 ? "…" : "") + "に移動",
				action: () => {
					deleteReac(reaction);
					reactions2.push(reaction);
				},
			} : undefined,
			tab !== 'reactions3' && !reactions3.includes(reaction) ? {
				text: (reactionsFolderName3 || "3")?.slice(0,6) + (reactionsFolderName3?.length > 6 ? "…" : "") + "に移動",
				action: () => {
					deleteReac(reaction);
					reactions3.push(reaction);
				},
			} : undefined,
			tab !== 'reactions4' && !reactions4.includes(reaction) ? {
				text: (reactionsFolderName4 || "4")?.slice(0,6) + (reactionsFolderName4?.length > 6 ? "…" : "") + "に移動",
				action: () => {
					deleteReac(reaction);
					reactions4.push(reaction);
				},
			} : undefined,
			tab !== 'reactions5' && !reactions5.includes(reaction) ? {
				text: (reactionsFolderName5 || "5")?.slice(0,6) + (reactionsFolderName5?.length > 6 ? "…" : "") + "に移動",
				action: () => {
					deleteReac(reaction);
					reactions5.push(reaction);
				},
			} : undefined,
			{
				text: i18n.ts.remove,
				action: () => {
					deleteReac(reaction);
				},
			},
		].filter((x) => x !== undefined),
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
		text: i18n.ts.resetAreYouSure + "\n※1ページ目のみデフォルトに戻します",
	});
	if (canceled) return;

	reactions = deepClone(defaultStore.def.reactions.default);
}

async function setEmpty() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.ts.deleteReactionAreYouSure,
	});
	if (canceled) return;

	deleteAllReac();
}

function chooseEmoji(ev: MouseEvent) {
	os.pickEmoji(ev.currentTarget ?? ev.target, {
		showPinned: false,
		asReactionPicker: true,
	}).then((emoji) => {
		if (!editPage.includes(emoji)) {
			editPage.push(emoji);
		}
	});
}

onMounted(async () => {
	if (!unref(instance.emojiStats)) {
		const data = await os.api("users/emoji-stats", {
			userId: $i.id,
			limit: 80,
		});
		unref(instance.emojiStats) = data;
	}
});

watch(
	[$$(reactions),$$(reactions2),$$(reactions3),$$(reactions4),$$(reactions5)],
	() => {
		save();
	},
	{
		deep: true,
	}
);

watch([
	enableEmojiReactions,
	remoteEmojisFetch
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
