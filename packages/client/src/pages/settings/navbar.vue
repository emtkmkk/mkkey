<template>
	<div class="_formRoot">
		<FormSlot>
			<template #label>{{ i18n.ts.navbar }}</template>
			<MkContainer :showHeader="false">
				<Sortable
					v-model="items"
					itemKey="id"
					:animation="150"
					:handle="'.' + $style.itemHandle"
					@start="(e) => e.item.classList.add('active')"
					@end="(e) => e.item.classList.remove('active')"
				>
					<template #item="{ element, index }">
						<div
							v-if="
								element.type === '-' ||
								navbarItemDef[element.type]
							"
							:class="$style.item"
						>
							<button class="_button" :class="$style.itemHandle">
								<i class="ph-bold ph-list ph-lg"></i>
							</button>
							<i
								class="ph-fw"
								:class="[
									$style.itemIcon,
									navbarItemDef[element.type]?.icon,
								]"
							></i
							><span :class="$style.itemText">{{
								i18n.ts[
									navbarItemDef[element.type]?.title ??
										divider
								]
							}}</span>
							<button
								class="_button"
								:class="$style.itemRemove"
								@click="removeItem(index)"
							>
								<i class="ph-bold ph-lg ph-x"></i>
							</button>
						</div>
					</template>
				</Sortable>
			</MkContainer>
		</FormSlot>
		<div class="_buttons">
			<FormButton @click="addItem"
				><i class="ph-bold ph-plus ph-lg"></i>
				{{ i18n.ts.addItem }}</FormButton
			>
			<FormButton primary class="save" @click="save"
				><i class="ph-bold ph-floppy-disk ph-lg"></i>
				{{ i18n.ts.save }}</FormButton
			>
		</div>

		<FormRadios v-model="menuDisplay" class="_formBlock">
			<template #label>{{ i18n.ts.display }}</template>
			<option value="sideFull">
				{{ i18n.ts._menuDisplay.sideFull }}
			</option>
			<option value="sideIcon">
				{{ i18n.ts._menuDisplay.sideIcon }}
			</option>
			<!-- <option value="top">{{ i18n.ts._menuDisplay.top }}</option> -->
			<!-- <MkRadio v-model="menuDisplay" value="hide" disabled>{{ i18n.ts._menuDisplay.hide }}</MkRadio>-->
			<!-- TODO: サイドバーを完全に隠せるようにすると、別途ハンバーガーボタンのようなものをUIに表示する必要があり面倒 -->
		</FormRadios>

		<FormRadios
			v-if="!freeThirdButton"
			v-model="mobileThirdButton"
			class="_formBlock"
		>
			<template #label
				>{{ i18n.ts.mobileThirdButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<option value="reload">
				{{ i18n.ts.reload }}
			</option>
			<option value="messaging">
				{{ i18n.ts.messaging }}
			</option>
			<option value="changeAccount">
				{{ i18n.ts.changeAccount }}
			</option>
			<option value="hidden">
				{{ i18n.ts.hidden }}
			</option>
		</FormRadios>
		<FormInput
			v-if="freeThirdButton"
			v-model="mobileThirdButton"
			class="_formBlock"
			:small="true"
			:placeholder="i18n.ts.mobileThirdButton"
			:manualSave="true"
			style="margin: 0 0 !important"
		/>
		<button v-if="freeThirdButton" class="_textButton" @click="setItem">
			{{ i18n.ts.setItem }}
		</button>
		<FormSwitch v-model="freeThirdButton" class="_formBlock"
			>{{ i18n.ts.freeThirdButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span></FormSwitch
		>

		<FormButton danger class="_formBlock" @click="reset()"
			><i class="ph-arrow-clockwise ph-bold ph-lg"></i>
			{{ i18n.ts.default }}</FormButton
		>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, unref, defineAsyncComponent } from "vue";
import FormInput from "@/components/form/input.vue";
import FormRadios from "@/components/form/radios.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormButton from "@/components/MkButton.vue";
import FormSlot from "@/components/form/slot.vue";
import MkContainer from "@/components/MkContainer.vue";
import * as os from "@/os";
import { navbarItemDef } from "@/navbar";
import { defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deepClone } from "@/scripts/clone";

const Sortable = defineAsyncComponent(() =>
	import("vuedraggable").then((x) => x.default)
);

const items = ref(
	defaultStore.state.menu.map((x) => ({
		id: Math.random().toString(),
		type: x,
	}))
);

const menuDisplay = computed(defaultStore.makeGetterSetter("menuDisplay"));
const mobileThirdButton = computed(
	defaultStore.makeGetterSetter("mobileThirdButton")
);
const freeThirdButton = ref(
	!["reload", "messaging", "changeAccount", "hidden"].includes(
		unref(mobileThirdButton)
	)
);

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

async function addItem() {
	const menu = Object.keys(navbarItemDef).filter(
		(k) => !defaultStore.state.menu.includes(k)
	);
	const { canceled, result: item } = await os.select({
		title: i18n.ts.addItem,
		items: [
			...menu.map((k) => ({
				value: k,
				text: i18n.ts[navbarItemDef[k].title],
			})),
			{
				value: "-",
				text: i18n.ts.divider,
			},
		],
	});
	if (canceled) return;
	items.value = [
		...items.value,
		{
			id: Math.random().toString(),
			type: item,
		},
	];
}

async function setItem() {
	const menu = Object.keys(navbarItemDef);
	const { canceled, result: item } = await os.select({
		title: i18n.ts.setItem,
		items: [
			...menu.map((k) => ({
				value: k,
				text: i18n.ts[navbarItemDef[k].title],
			})),
			{
				value: "hidden",
				text: i18n.ts.hidden,
			},
		],
	});
	if (canceled) return;
	mobileThirdButton.value = item;
}

function removeItem(index: number) {
	items.value.splice(index, 1);
}

async function save() {
	defaultStore.set(
		"menu",
		items.value.map((x) => x.type)
	);
	await reloadAsk();
}

function reset() {
	items.value = defaultStore.def.menu.default.map((x) => ({
		id: Math.random().toString(),
		type: x,
	}));
}

watch(menuDisplay, async () => {
	await reloadAsk();
});

watch(mobileThirdButton, async (v) => {
	if (v === "hidden" || navbarItemDef[v]) await reloadAsk();
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.navbar,
	icon: "ph-list-bullets ph-bold ph-lg",
});
</script>

<style lang="scss" module>
.item {
	position: relative;
	display: block;
	line-height: 2.85rem;
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
	color: var(--navFg);
}

.itemIcon {
	position: relative;
	width: 32px;
	margin-right: 8px;
}

.itemText {
	position: relative;
	font-size: 0.9em;
}

.itemRemove {
	position: absolute;
	z-index: 10000;
	width: 32px;
	height: 32px;
	color: #ff2a2a;
	right: 8px;
	opacity: 0.8;
}

.itemHandle {
	cursor: move;
	width: 32px;
	height: 32px;
	margin: 0 8px;
	opacity: 0.5;
}
</style>
