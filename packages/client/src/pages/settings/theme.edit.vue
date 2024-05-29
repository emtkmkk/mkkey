<template>
	<div class="_formRoot">
		<div
			class="_formBlock"
			style="display: flex; gap: var(--margin); flex-wrap: wrap"
		>
			<FormButton
				:disable="
					!installThemeCode || !Object.keys(installThemeCode)?.length
				"
				inline
				@click="
					() => preview(JSON5.stringify(installThemeCode, null, '\t'))
				"
				><i class="ph-eye ph-bold ph-lg"></i>
				{{ i18n.ts.preview }}</FormButton
			>
			<FormButton
				:disable="
					!installThemeCode || !Object.keys(installThemeCode)?.length
				"
				primary
				inline
				@click="
					() => install(JSON5.stringify(installThemeCode, null, '\t'))
				"
				><i class="ph-check ph-bold ph-lg"></i>
				{{ i18n.ts.install }}</FormButton
			>
		</div>
		<MkKeyValueEditor
			v-if="installThemeCode != null"
			:data="installThemeCode"
			@update="updateThemeData"
		/>
	</div>
</template>

<script lang="ts" setup>
import { onActivated, watch } from "vue";
import JSON5 from "json5";
import MkKeyValueEditor from "@/components/MkKeyValueEditor.vue";
import FormButton from "@/components/MkButton.vue";
import { Theme, applyTheme, validateTheme } from "@/scripts/theme";
import * as os from "@/os";
import { addTheme, getThemes } from "@/theme-store";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { ColdDeviceStorage, defaultStore } from "@/store";
import lightTheme from "@/themes/_light.json5";
import darkTheme from "@/themes/_dark.json5";

let installThemeCode = $ref<Record<string, any> | null>(null);

let nowTheme =  $ref<Record<string, any> | null>(null);

watch($$(installThemeCode), apply, { deep: true });

function apply() {
	try{
		applyTheme(installThemeCode as Theme, false);
		nowTheme = installThemeCode
	} catch {

	}
}

function parseThemeCode(code: string) {
	let theme;

	try {
		theme = JSON5.parse(code);
	} catch (err) {
		os.alert({
			type: "error",
			text: [i18n.ts._theme.invalid, err?.message]
				.filter(Boolean)
				.join("\n"),
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
	/*
	if (getThemes().some((t) => t.id === theme.id)) {
		os.alert({
			type: "info",
			text: i18n.ts._theme.alreadyInstalled,
		});
		return false;
	}
	*/

	return theme;
}

function preview(code: string): void {
	const theme = parseThemeCode(code);
	if (theme && nowTheme === installThemeCode) {
		showPreview();
	} else {
		if (theme) {
			nowTheme = installThemeCode;
			applyTheme(theme, false);
		}
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

	if (darkMode) {
		installThemeCode = ColdDeviceStorage.ref("darkTheme")?.value;
	} else {
		installThemeCode = ColdDeviceStorage.ref("lightTheme")?.value;
	}
	if (installThemeCode?.base) {
		const base = [lightTheme, darkTheme].find(
			(x) => x.id === installThemeCode?.base
		);
		if (base)
			installThemeCode.props = Object.assign(
				{},
				base.props,
				installThemeCode.props
			);
	}
}

const updateThemeData = (updatedData: Record<string, any>) => {
	installThemeCode = updatedData;
};

function showPreview() {
	os.pageWindow("/preview");
}

onActivated(() => {
	loadTheme();
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts._theme.install,
	icon: "ph-download-simple ph-bold ph-lg",
});
</script>
