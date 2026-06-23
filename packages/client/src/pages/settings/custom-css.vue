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

				<FormFolder class="_formBlock">
					<template #label>{{ i18n.ts._cssSnippet.operations }}</template>
					<template #icon
						><i class="ph-wrench ph-bold ph-lg"></i
					></template>
					<div class="snippet-operations">
						<FormLink
							:to="`/settings/custom-css/edit/${snippet.id}`"
						>
							<template #icon>
								<i class="ph-pencil ph-bold ph-lg"></i>
							</template>
							{{ i18n.ts._cssSnippet.edit }}
						</FormLink>
						<MkButton inline danger @click="removeSnippet(snippet)">
							<i class="ph-trash ph-bold ph-lg"></i>
							{{ i18n.ts.delete }}
						</MkButton>
					</div>
				</FormFolder>
			</div>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * カスタム CSS スニペットの一覧・有効化画面。
 *
 * @remarks
 * - 編集は専用ページ（custom-css.edit.vue）へ遷移する。
 * - ON/OFF トグルはページ再読み込みなしで反映する。
 *
 * @public
 */
import { ref, onMounted, onActivated } from "vue";
import FormSection from "@/components/form/section.vue";
import FormFolder from "@/components/form/folder.vue";
import FormLink from "@/components/form/link.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormInfo from "@/components/MkInfo.vue";
import MkButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { useRouter } from "@/router";
import {
	changeCssSnippetActive,
	createCssSnippet,
	deleteCssSnippet,
	getCssSnippets,
	type CssSnippet,
} from "@/css-snippet";

const router = useRouter();
const snippets = ref<CssSnippet[]>([]);

function refreshSnippets(): void {
	snippets.value = getCssSnippets();
}

onMounted(() => {
	refreshSnippets();
});

onActivated(() => {
	refreshSnippets();
});

function changeActive(snippet: CssSnippet, active: boolean): void {
	changeCssSnippetActive(snippet.id, active);
	refreshSnippets();
}

function addSnippet(): void {
	const snippet = createCssSnippet({
		name: i18n.ts._cssSnippet.newSnippetName,
		css: "",
		active: true,
	});
	router.push(`/settings/custom-css/edit/${snippet.id}`);
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
.snippet-card {
	padding: 1.25rem;
}

.snippet-card-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 0.75rem;
	margin-bottom: 0.5rem;
}

.snippet-description {
	margin: 0 0 0.75rem;
	opacity: 0.85;
	font-size: 0.9em;
}

.snippet-operations {
	display: flex;
	flex-wrap: wrap;
	gap: var(--margin);
	align-items: center;
}
</style>
