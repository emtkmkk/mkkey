<template>
	<div class="_formRoot" :class="$style.root">
		<div :class="$style.buttons">
			<MkButton inline primary @click="saveNew">{{
				ts._drafts.saveNew
			}}</MkButton>
		</div>

		<FormSection>
			<template #label>{{ ts._drafts.list }}</template>
			<template v-if="drafts && Object.keys(drafts).length > 0">
				<div
					v-for="draft in drafts"
					:key="draft.key"
					class="_formBlock _panel"
					:class="$style.draft"
					@click="($event) => menu($event, draft.key)"
					@contextmenu.prevent.stop="($event) => menu($event, draft.key)"
				>
					<div :class="$style.draftName">{{ draft.value.name || convertName(draft.key) }}</div>
					<div :class="$style.draftText">
						{{
							`${draft.value.data.useCw ? `${draft.value.data.cw || "CW"} / ` : ""}${draft.value.data.text || ts._drafts.noText}`
						}}
					</div>
					<div v-if="draft.value.data.visibility !== 'public' || draft.value.data.localOnly || draft.value.data.files?.length || draft.value.data.poll || draft.value.data.quoteId" :class="$style.draftText">
						{{
							`${draft.value.data.visibility !== "public" && ts._visibility[draft.value.data.visibility] ? ts._visibility[draft.value.data.visibility] + " " : "" }${draft.value.data.localOnly ? ts._visibility.localAndFollower + " " : "" }${draft.value.data.quoteId ? ts._drafts.quote : ""}${draft.value.data.quoteId ? ts._drafts.quote : ""}${draft.value.data.poll ? ts._drafts.poll : ""}${draft.value.data.files?.length ? `${i18n.t("_drafts.files", { count: draft.value.data.files?.length })} ` : ""}`
						}}
					</div>
				</div>
			</template>
			<div v-else-if="drafts">
				<MkInfo>{{ ts._drafts.noDrafts }}</MkInfo>
			</div>
			<MkLoading v-else />
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, useCssModule } from "vue";
import { v4 as uuid } from "uuid";
import FormSection from "@/components/form/section.vue";
import MkButton from "@/components/MkButton.vue";
import MkInfo from "@/components/MkInfo.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
const { t, ts } = i18n;
import { MenuItem } from "@/types/menu";

const emit = defineEmits<{
	(ev: "done", v: { canceled: boolean; result: any }): void;
	(ev: "save", v: { canceled: boolean; key: any; name: any }): void;
	(ev: "load", v: { canceled: boolean; key: any }): void;
	(ev: "delete", v: { canceled: boolean; key: any }): void;
	(ev: "closed"): void;
}>();

let jsonParse = $ref(JSON.parse(localStorage.getItem("drafts") || "{}"));

let drafts = $computed(() => {
	return Object.keys(jsonParse.filter((x) => (x.data.text || (x.data.useCw && x.data.cw) || x.data.files?.length || x.data.poll))).map((x) => { 
	return {key:x, value:jsonParse[x]}; 
}).sort((a, b) => {
	function sortNo(draftKey) {
		const _draftKey = draftKey.split(":");
		if (_draftKey.length !== 2) return 1
		switch (_draftKey[0]) {
			case 'renote':
				return 6;
			case 'reply':
				return 5;
			case 'note':
				return 7;
			case 'channel':
				return 4;
			case 'edit':
				return 3;
			case 'auto':
				return 0;
			case 'manual':
				return 0;
			default:
				return 2;
		}
	}
	if (sortNo(a.key) === sortNo(b.key)) {
		try{
			return Date.parse(b.value.updatedAt) - Date.parse(a.value.updatedAt);
		}catch{
			return 0;
		}
	} else {
		return sortNo(a.key) - sortNo(b.key);
	}
})
});

useCssModule();

function convertName(draftKey: string): string {
	if (!jsonParse[draftKey]) return "";
	const _draftKey = draftKey.split(":");
	const updatedAt = new Date(jsonParse[draftKey].updatedAt).toLocaleString()
	if (_draftKey.length !== 2) return `${ts._drafts.normal}${updatedAt}`
	switch (_draftKey[0]) {
		case 'renote':
			return `${ts._drafts.qt}${updatedAt}`
		case 'reply':
			return `${ts._drafts.reply}${updatedAt}`
		case 'note':
			return `${ts._drafts.note}${updatedAt}`
		case 'edit':
			return `${ts._drafts.edit}${updatedAt}`
		case 'auto':
			return `${ts._drafts.auto}${updatedAt}`
		case 'manual':
			return `${ts._drafts.manual}${updatedAt}`
		case 'channel':
			return `${ts._drafts.channel}${updatedAt}`
		default:
			return `${updatedAt}`
	}
}

async function saveNew() {
	const { canceled, result: name } = await os.inputText({
		title: ts._drafts.inputName,
	});
	if (canceled) return;
	emit("save",{canceled:false,key:`manual:${uuid()?.slice(0, 8)}`,name})
	jsonParse = JSON.parse(localStorage.getItem("drafts") || "{}");
}

function load(key: string) {
	emit("load",{canceled:false,key})
}

function deleteDraft(key: string) {
	emit("delete",{canceled:false,key})
	jsonParse = JSON.parse(localStorage.getItem("drafts") || "{}");
}

function menu(ev: MouseEvent, draftKey: string) {
	if (!drafts) return;

	return os.popupMenu(
		[
			{
				text: ts._drafts.load,
				icon: "ph-caret-circle-down ph-bold ph-lg",
				action: () => load(draftKey),
			},
			...(defaultStore.state.developer ? [{
				type: "a",
				text: ts.download,
				icon: "ph-download-simple ph-bold ph-lg",
				href: URL.createObjectURL(
					new Blob([JSON.stringify(jsonParse[draftKey], null, 2)], {
						type: "application/json",
					})
				),
				download: `${jsonParse[draftKey].name || draftKey}.json`,
			} as MenuItem] : []),
			null,
			{
				text: ts._drafts.delete,
				icon: "ph-trash ph-bold ph-lg",
				action: () => deleteDraft(draftKey),
				danger: true,
			},
		],
		ev.currentTarget ?? ev.target
	);
}

definePageMetadata(
	computed(() => ({
		title: ts._drafts.title,
		icon: "ph-floppy-disk ph-bold ph-lg",
		bg: "var(--bg)",
	}))
);
</script>

<style lang="scss" module>
.root {
	background: var(--bg);
}
.buttons {
	display: flex;
	gap: var(--margin);
	flex-wrap: wrap;
}

.draft {
	padding: 20px;
	cursor: pointer;

	&Name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-weight: 700;
	}

	&Text {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.85em;
		opacity: 0.7;
	}
}
</style>
