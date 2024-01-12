<template>
	<div class="_formRoot">
		<FormSection>
			<template #label>{{ i18n.ts.power }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			<FormSwitch v-model="powerMode" class="_formBlock">{{
				i18n.ts.powerMode
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeColorful" class="_formBlock">{{
				i18n.ts.powerModeColorful
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeNoShake" class="_formBlock">{{
				i18n.ts.powerModeNoShake
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
		</FormSection>
		<FormSection>
			<template #label>{{ i18n.ts.emojiReplace }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			<FormSwitch v-model="enableEmojiReplace" class="_formBlock">{{
				i18n.ts.enableEmojiReplace
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			
			<div v-panel v-if="enableEmojiReplace" style="border-radius: 6px">
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
							<MkEmoji :emoji="element" :normal="true" :nofallback="true" noreplace />
						</button>
					</template>
					<template #footer>
						<button class="_button add" @click="chooseEmoji">
							<i class="ph-plus ph-bold ph-lg"></i>
						</button>
					</template>
				</XDraggable>
			</div>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import XDraggable from "vuedraggable";
import FormButton from "@/components/MkButton.vue";
import FormLink from "@/components/form/link.vue";
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


const developer = computed(
	defaultStore.makeGetterSetter("developer")
);
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
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
let allEmojiReplace = $ref(deepClone(defaultStore.state.allEmojiReplace));
const enableEmojiReplace = computed(
	defaultStore.makeGetterSetter("enableEmojiReplace")
);

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
				text: reaction.replace(/@(\S+)$/,"").replaceAll(":",""),
				type: "label",
			},
			reaction.includes("@") ? {
				text: reaction.replace(/^(\S+)@/,"@").replaceAll(":",""),
				type: "label",
			} : undefined,
			{
				text: i18n.ts.remove,
				action: () => {
					allEmojiReplace = allEmojiReplace.filter((x) => x !== reaction);
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
		powerMode,
	],
	async () => {
		await reloadAsk();
	}
);

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.funSetting,
	icon: "ph-confetti ph-bold ph-lg",
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

