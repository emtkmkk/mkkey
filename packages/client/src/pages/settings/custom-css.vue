<template>
	<div class="_formRoot">
		<FormInfo warn class="_formBlock">{{ i18n.ts.customCssWarn }}</FormInfo>

		<div class="_formBlock">
			<MkButton inline primary @click="addSnippet">
				<i class="ph-plus ph-bold ph-lg"></i>
				{{ i18n.ts._cssSnippet.add }}
			</MkButton>
		</div>

		<FormSection>
			<template #label>{{ i18n.ts._cssSnippet.manage }}</template>

			<FormInfo v-if="snippets.length === 0" class="_formBlock">
				{{ i18n.ts._cssSnippet.noSnippets }}
			</FormInfo>

			<div
				v-for="snippet in snippets"
				:key="snippet.id"
				class="_formBlock _panel snippet-card"
			>
				<div class="snippet-card-header">
					<b>{{ snippet.name }}</b>
				</div>

				<p v-if="snippet.description" class="snippet-description">
					{{ snippet.description }}
				</p>

				<FormSwitch
					class="_formBlock"
					:model-value="snippet.active"
					@update:model-value="changeActive(snippet, $event)"
				>
					{{ i18n.ts.makeActive }}
				</FormSwitch>

				<div class="_formBlock snippet-actions">
					<MkButton inline @click="editMetadata(snippet)">
						<i class="ph-pencil ph-bold ph-lg"></i>
						{{ i18n.ts._cssSnippet.editMetadata }}
					</MkButton>
					<MkButton inline @click="editCss(snippet)">
						<i class="ph-code ph-bold ph-lg"></i>
						{{ i18n.ts._cssSnippet.editCss }}
					</MkButton>
					<MkButton inline danger @click="removeSnippet(snippet)">
						<i class="ph-trash ph-bold ph-lg"></i>
						{{ i18n.ts.delete }}
					</MkButton>
				</div>
			</div>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * カスタム CSS スニペットの一覧・有効化・編集画面。
 *
 * @remarks
 * - ON/OFF トグルはページ再読み込みなしで反映する。
 * - CSS 本文の変更後は従来どおり再読み込みを促す。
 *
 * @public
 */
import { ref, onMounted } from "vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormInfo from "@/components/MkInfo.vue";
import MkButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { unisonReload } from "@/scripts/unison-reload";
import {
	changeCssSnippetActive,
	createCssSnippet,
	deleteCssSnippet,
	getCssSnippets,
	updateCssSnippet,
	type CssSnippet,
} from "@/css-snippet";

const snippets = ref<CssSnippet[]>([]);

function refreshSnippets(): void {
	snippets.value = getCssSnippets();
}

onMounted(() => {
	refreshSnippets();
});

function changeActive(snippet: CssSnippet, active: boolean): void {
	changeCssSnippetActive(snippet.id, active);
	refreshSnippets();
}

async function addSnippet(): Promise<void> {
	const { canceled, result: name } = await os.inputText({
		title: i18n.ts._cssSnippet.add,
		placeholder: i18n.ts._cssSnippet.namePlaceholder,
	});
	if (canceled || !name?.trim()) return;

	const { canceled: descCanceled, result: description } =
		await os.inputParagraph({
			title: i18n.ts._cssSnippet.description,
			placeholder: i18n.ts._cssSnippet.descriptionPlaceholder,
		});
	if (descCanceled) return;

	createCssSnippet({
		name: name.trim(),
		description: description?.trim() || undefined,
		css: "",
		active: true,
	});
	refreshSnippets();
	os.success();
}

async function editMetadata(snippet: CssSnippet): Promise<void> {
	const { canceled, result: name } = await os.inputText({
		title: i18n.ts._cssSnippet.editMetadata,
		default: snippet.name,
	});
	if (canceled || !name?.trim()) return;

	const { canceled: descCanceled, result: description } =
		await os.inputParagraph({
			title: i18n.ts._cssSnippet.description,
			default: snippet.description ?? "",
			placeholder: i18n.ts._cssSnippet.descriptionPlaceholder,
		});
	if (descCanceled) return;

	updateCssSnippet(snippet.id, {
		name: name.trim(),
		description: description?.trim() || undefined,
	});
	refreshSnippets();
	os.success();
}

async function editCss(snippet: CssSnippet): Promise<void> {
	const { canceled, result: css } = await os.inputParagraph({
		title: i18n.ts._cssSnippet.editCss,
		default: snippet.css,
		placeholder: "CSS",
	});
	if (canceled) return;

	updateCssSnippet(snippet.id, { css: css ?? "" });

	const { canceled: reloadCanceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (reloadCanceled) {
		refreshSnippets();
		return;
	}

	unisonReload();
}

async function removeSnippet(snippet: CssSnippet): Promise<void> {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("removeAreYouSure", { x: snippet.name }),
	});
	if (canceled) return;

	deleteCssSnippet(snippet.id);
	refreshSnippets();
	os.success();
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.customCss,
	icon: "ph-code ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.snippet-card-header {
	margin-bottom: 0.5rem;
}

.snippet-description {
	margin: 0 0 0.75rem;
	opacity: 0.85;
	font-size: 0.9em;
}

.snippet-actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--margin);
}
</style>
