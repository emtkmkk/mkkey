<template>
	<div class="_formRoot">
		<FormTextarea v-model="installThemeCode" class="_formBlock">
			<template #label>{{ i18n.ts._theme.code }}</template>
		</FormTextarea>

		<div
			class="_formBlock"
			style="display: flex; gap: var(--margin); flex-wrap: wrap"
		>
			<FormButton
				v-show="installThemeCode == null"
				inline
				@click="() => loadTheme()"
				><i class="ph-palette ph-bold ph-lg"></i>
				{{ i18n.ts.loadTheme }}</FormButton
			>
			<FormButton
				v-show="installThemeCode != null"
				inline
				@click="() => preview(installThemeCode)"
				><i class="ph-eye ph-bold ph-lg"></i>
				{{ i18n.ts.preview }}</FormButton
			>
			<FormButton
				v-show="installThemeCode != null"
				primary
				inline
				@click="() => install(installThemeCode)"
				><i class="ph-check ph-bold ph-lg"></i>
				{{ i18n.ts.install }}</FormButton
			>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import JSON5 from "json5";
import FormTextarea from "@/components/form/textarea.vue";
import FormButton from "@/components/MkButton.vue";
import { applyTheme, validateTheme } from "@/scripts/theme";
import * as os from "@/os";
import { addTheme, getThemes } from "@/theme-store";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { ColdDeviceStorage, defaultStore } from "@/store";
import { defaults } from "chart.js";
import lightTheme from "@/themes/_light.json5";
import darkTheme from "@/themes/_dark.json5";

let installThemeCode = $ref<string | null>(null);
let nowTheme = "";

function parseThemeCode(code: string) {
	let theme;

	try {
		theme = JSON5.parse(code);
	} catch (err) {
		os.alert({
			type: "error",
			text: i18n.ts._theme.invalid,
		});
		return false;
	}
	if (!validateTheme(theme)) {
		os.alert({
			type: "error",
			text: i18n.ts._theme.invalid,
		});
		return false;
	}
	if (getThemes().some((t) => t.id === theme.id)) {
		os.alert({
			type: "info",
			text: i18n.ts._theme.alreadyInstalled,
		});
		return false;
	}

	return theme;
}

function preview(code: string): void {
	const theme = parseThemeCode(code);
	if (theme && nowTheme === theme) {
		showPreview();
	} else {
		nowTheme = theme;
		applyTheme(theme, false);
	}
}
async function install(code: string): Promise<void> {
	const theme = parseThemeCode(code);
	if (!theme) return;
	await addTheme(theme);
	os.alert({
		type: "success",
		text: i18n.t("_theme.installed", { name: theme.name }),
	});
}

function loadTheme() {
	const darkMode = defaultStore.state.darkMode;

	let theme;
	if (darkMode) {
		theme = ColdDeviceStorage.ref("darkTheme")?.value;
	} else {
		theme = ColdDeviceStorage.ref("lightTheme")?.value;
	}
	
	if (theme?.base) {
		const base = [lightTheme, darkTheme].find(
			(x) => x.id === theme?.base
		);
		if (base)
			theme.props = Object.assign(
				{},
				base.props,
				theme.props
			);
	}
	installThemeCode = JSON5.stringify(
		theme,
		null,
		"\t"
	);
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts._theme.install,
	icon: "ph-download-simple ph-bold ph-lg",
});
</script>
