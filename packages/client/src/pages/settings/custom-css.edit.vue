<template>
	<div class="_formRoot">
		<template v-if="notFound">
			<FormInfo warn class="_formBlock">
				{{ i18n.ts._cssSnippet.notFound }}
			</FormInfo>
			<FormLink to="/settings/custom-css" class="_formBlock">
				<template #icon>
					<i class="ph-arrow-left ph-bold ph-lg"></i>
				</template>
				{{ i18n.ts._cssSnippet.manage }}
			</FormLink>
		</template>

		<template v-else>
			<FormInfo warn class="_formBlock">{{ i18n.ts.customCssWarn }}</FormInfo>

			<FormInput v-model="name" class="_formBlock">
				<template #label>{{ i18n.ts._cssSnippet.namePlaceholder }}</template>
			</FormInput>

			<FormTextarea v-model="description" class="_formBlock">
				<template #label>{{ i18n.ts._cssSnippet.description }}</template>
			</FormTextarea>

			<FormTextarea
				v-model="css"
				manual-save
				tall
				class="_monospace _formBlock"
				style="tab-size: 2"
			>
				<template #label>CSS</template>
			</FormTextarea>
		</template>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * カスタム CSS スニペット1件の編集画面。
 *
 * @remarks
 * - 名前・説明は即時保存（リロード不要）。
 * - CSS 本文の変更後は再読み込みを促す（旧カスタム CSS 画面と同様）。
 *
 * @public
 */
import { computed, onActivated, onMounted, watch } from "vue";
import FormInput from "@/components/form/input.vue";
import FormTextarea from "@/components/form/textarea.vue";
import FormLink from "@/components/form/link.vue";
import FormInfo from "@/components/MkInfo.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { unisonReload } from "@/scripts/unison-reload";
import {
	applySnippetToDom,
	getCssSnippetById,
	updateCssSnippet,
} from "@/css-snippet";

const props = defineProps<{
	snippetId: string;
}>();

let name = $ref("");
let description = $ref("");
let css = $ref("");
let notFound = $ref(false);
/** 初回読み込み完了後のみ watch で保存する */
let ready = $ref(false);
/** watch の初回発火・読み込み時の誤保存を防ぐ */
let lastName = $ref("");
let lastDescription = $ref("");
let lastCss = $ref("");

function loadSnippet(): void {
	const snippet = getCssSnippetById(props.snippetId);
	if (!snippet) {
		notFound = true;
		ready = false;
		return;
	}

	notFound = false;
	ready = false;
	lastName = snippet.name;
	lastDescription = snippet.description ?? "";
	lastCss = snippet.css;
	name = snippet.name;
	description = snippet.description ?? "";
	css = snippet.css;
	ready = true;
}

function saveMetadata(): void {
	if (!ready || notFound) return;
	updateCssSnippet(props.snippetId, {
		name: name.trim(),
		description: description.trim() || undefined,
	});
}

async function saveCss(): Promise<void> {
	if (!ready || notFound) return;

	const updated = updateCssSnippet(props.snippetId, { css });
	if (updated?.active) {
		applySnippetToDom(updated);
	}

	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

onMounted(() => {
	loadSnippet();
});

onActivated(() => {
	loadSnippet();
});

watch($$(name), () => {
	if (!ready || notFound || name === lastName) return;
	lastName = name;
	saveMetadata();
});

watch($$(description), () => {
	if (!ready || notFound || description === lastDescription) return;
	lastDescription = description;
	saveMetadata();
});

watch($$(css), async () => {
	if (!ready || notFound || css === lastCss) return;
	lastCss = css;
	await saveCss();
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() => ({
		title: notFound
			? i18n.ts._cssSnippet.notFound
			: name.trim() || i18n.ts.customCss,
		icon: "ph-code ph-bold ph-lg",
	})),
);
</script>
