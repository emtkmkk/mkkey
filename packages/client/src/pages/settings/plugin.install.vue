<template>
	<div class="_formRoot">
		<FormInfo warn class="_formBlock">{{
			i18n.ts._plugin.installWarn
		}}</FormInfo>

		<FormTextarea v-model="code" tall class="_formBlock">
			<template #label>{{ i18n.ts.code }}</template>
		</FormTextarea>

		<div class="_formBlock">
			<FormButton inline @click="pickFile">
				<i class="ph-file ph-bold ph-lg"></i>
				{{ i18n.ts._plugin.loadFromFile }}
			</FormButton>
			<input
				ref="fileInput"
				type="file"
				accept=".as,.ais,.txt,text/plain"
				style="display: none"
				@change="onFilePicked"
			/>
		</div>

		<div class="_formBlock">
			<FormButton :disabled="code == null" primary inline @click="install">
				<i class="ph-check ph-bold ph-lg"></i>
				{{ i18n.ts.install }}
			</FormButton>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * AiScript プラグインのインストール画面。
 *
 * @public
 */
import { ref } from "vue";
import FormTextarea from "@/components/form/textarea.vue";
import FormButton from "@/components/MkButton.vue";
import FormInfo from "@/components/MkInfo.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { useRouter } from "@/router";
import { installPlugin } from "@/plugin";

const router = useRouter();

const code = ref<string>();
const fileInput = ref<HTMLInputElement | null>(null);

function pickFile(): void {
	fileInput.value?.click();
}

function onFilePicked(ev: Event): void {
	const input = ev.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = () => {
		code.value = String(reader.result ?? "");
		input.value = "";
	};
	reader.readAsText(file);
}

function installErrorMessage(err: unknown): string {
	if (!(err instanceof Error)) return String(err);
	switch (err.message) {
		case "noLangVersion":
			return i18n.ts.pluginInstallNoLangVersion;
		case "syntaxError":
			return i18n.ts.pluginInstallSyntaxError;
		case "noMetadata":
			return i18n.ts.pluginInstallNoMetadata;
		case "requiredProperty":
			return i18n.ts.pluginInstallRequiredProperty;
		case "duplicate":
			return i18n.ts._plugin.duplicateName;
		default:
			if (err.message.startsWith("unsupportedVersion:")) {
				return i18n.t("pluginInstallUnsupportedVersion", {
					version: err.message.split(":")[1] ?? "",
				});
			}
			return err.message;
	}
}

async function install(): Promise<void> {
	if (code.value == null) return;

	try {
		await installPlugin(code.value);
		os.success();
		router.push("/settings/plugin");
	} catch (err) {
		os.alert({ type: "error", text: installErrorMessage(err) });
	}
}

const headerActions = $computed(() => []);
const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts._plugin.install,
	icon: "ph-download-simple ph-bold ph-lg",
});
</script>
