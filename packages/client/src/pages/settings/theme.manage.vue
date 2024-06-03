<template>
	<div class="_formRoot">
		<FormSelect v-model="selectedThemeId" class="_formBlock">
			<template #label>{{ i18n.ts.theme }}</template>
			<optgroup :label="i18n.ts._theme.installedThemes">
				<option v-for="x in installedThemes" :key="x.id" :value="x.id">
					{{ x.name }}
				</option>
			</optgroup>
			<optgroup :label="i18n.ts._theme.builtinThemes">
				<option v-for="x in builtinThemes" :key="x.id" :value="x.id">
					{{ x.name }}
				</option>
			</optgroup>
		</FormSelect>
		<template v-if="selectedTheme">
			<FormInput
				readonly
				:model-value="selectedTheme.author"
				class="_formBlock"
			>
				<template #label>{{ i18n.ts.author }}</template>
			</FormInput>
			<FormTextarea
				v-if="selectedTheme.desc"
				readonly
				:model-value="selectedTheme.desc"
				class="_formBlock"
			>
				<template #label>{{ i18n.ts._theme.description }}</template>
			</FormTextarea>
			<FormTextarea
				readonly
				tall
				:model-value="selectedThemeCode"
				class="_formBlock"
			>
				<template #label>{{ i18n.ts._theme.code }}</template>
				<template #caption
					><button class="_textButton" @click="copyThemeCode()">
						{{ i18n.ts.copy }}
					</button></template
				>
			</FormTextarea>
			<FormTextarea
				v-if="shareCode.length > 0"
				readonly
				tall
				:model-value="shareCode"
				class="_formBlock"
			>
				<template #label>{{ "共有コード" }}</template><template #caption
					><button class="_textButton" @click="copyShareCode()">
						{{ i18n.ts.copy }}
					</button><span>{{ " ・ " }}</span><button class="_textButton" @click="postShareCode()">
						{{ i18n.ts.note }}
					</button></template
				>
			</FormTextarea>
			<FormButton
				v-if="!builtinThemes.some((t) => t.id == selectedTheme.id)"
				class="_formBlock"
				danger
				@click="uninstall()"
				><i class="ph-trash ph-bold ph-lg"></i>
				{{ i18n.ts.uninstall }}</FormButton
			>
			>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import JSON5 from "json5";
import FormTextarea from "@/components/form/textarea.vue";
import FormSelect from "@/components/form/select.vue";
import FormInput from "@/components/form/input.vue";
import FormButton from "@/components/MkButton.vue";
import { Theme, getBuiltinThemesRef } from "@/scripts/theme";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import * as os from "@/os";
import { getThemes, removeTheme } from "@/theme-store";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import lightTheme from "@/themes/_light.json5";
import darkTheme from "@/themes/_dark.json5";
import { v4 as uuid } from "uuid";
import * as config from "@/config";
import { $i } from "@/account";

const installedThemes = ref(getThemes());
const builtinThemes = getBuiltinThemesRef();
const selectedThemeId = ref(null);



const shareCode = computed(() => {
	if (!selectedTheme.value) return "";
	const theme = {...selectedTheme.value};
	const base = [lightTheme, darkTheme].find((x) => x.id === theme.base);
	if (base) {
		for (const prop in theme.props) {
			if (theme.props[prop] === base.props[prop]) {
				delete theme.props[prop];
			}
		}
	}
	for (const prop in theme) {
		if (typeof prop === "string" && !prop.trim()) {
			delete theme[prop];
		}
	}
	theme.id = uuid();
	if (!theme.author.trim()) theme.author = [$i?.username ? `@${$i?.username}` : undefined, config.host].join("@")
	return btoa(encodeURIComponent(JSON5.stringify(theme)));
});

const themes = computed(() => [
	...installedThemes.value,
	...builtinThemes.value,
]);

const selectedTheme = computed(() => {
	if (selectedThemeId.value == null) return null;
	return themes.value.find((x) => x.id === selectedThemeId.value);
});

const selectedThemeCode = computed(() => {
	if (selectedTheme.value == null) return null;
	return JSON5.stringify(selectedTheme.value, null, "\t");
});

function copyThemeCode() {
	copyToClipboard(selectedThemeCode.value);
	os.success();
}

function copyShareCode() {
	copyToClipboard(shareCode.value);
	os.success();
}

async function postShareCode() {
	if (selectedTheme.value && shareCode.value) {
		os.post({
			initialText: `${[selectedTheme.value?.name?.trim() ? `テーマ名：${selectedTheme.value.name}` : "",selectedTheme.value?.desc.trim() ? `説明：${selectedTheme.value.desc}` : "", selectedTheme.value?.author.trim() ? `作者：${selectedTheme.value.author}` : [$i?.username ? `@${$i?.username}` : undefined, config.host].join("@")].filter(Boolean).join("\n")}\n\n共有コード：\n\`\`\`\n${shareCode.value}\n\`\`\``,
			initialLocalOnly: true,
			instant: true,
		});
	}
}

function uninstall() {
	removeTheme(selectedTheme.value as Theme);
	installedThemes.value = installedThemes.value.filter(
		(t) => t.id !== selectedThemeId.value
	);
	selectedThemeId.value = null;
	os.success();
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts._theme.manage,
	icon: "ph-folder-notch-open ph-bold ph-lg",
});
</script>
