<template>
	<div class="_formRoot">
		<FormLink to="/settings/plugin/install">
			<template #icon>
				<i class="ph-download-simple ph-bold ph-lg"></i>
			</template>
			{{ i18n.ts._plugin.install }}
		</FormLink>

		<FormSection>
			<template #label>{{ i18n.ts.manage }}</template>

			<FormInfo v-if="plugins.length === 0" class="_formBlock">
				{{ i18n.ts._plugin.noPlugins }}
			</FormInfo>

			<div
				v-for="plugin in plugins"
				:key="plugin.id"
				class="_formBlock _panel plugin-card"
			>
				<div class="plugin-card-header">
					<div>
						<b>{{ plugin.name }}</b>
						<span v-if="langVersion(plugin)" class="plugin-lang-version">
							AiScript {{ langVersion(plugin) }}
						</span>
					</div>
					<span class="plugin-version">v{{ plugin.version }}</span>
				</div>

				<p v-if="plugin.description" class="plugin-description">
					{{ plugin.description }}
				</p>

				<span
					v-if="launchStatus(plugin.id) === 'error'"
					class="plugin-error-badge"
				>
					<i class="ph-warning ph-bold ph-lg"></i>
					{{ i18n.ts._plugin.startupError }}
				</span>

				<FormSwitch
					class="_formBlock"
					:model-value="plugin.active"
					@update:model-value="changeActive(plugin, $event)"
				>
					{{ i18n.ts.makeActive }}
				</FormSwitch>

				<MkKeyValue class="_formBlock">
					<template #key>{{ i18n.ts.author }}</template>
					<template #value>{{ plugin.author }}</template>
				</MkKeyValue>

				<MkKeyValue class="_formBlock">
					<template #key>{{ i18n.ts.permission }}</template>
					<template #value>
						<ul v-if="plugin.permissions?.length" class="plugin-permissions">
							<li v-for="p in plugin.permissions" :key="p">
								{{ permissionLabel(p) }}
							</li>
						</ul>
						<span v-else>{{ i18n.ts.none }}</span>
					</template>
				</MkKeyValue>

				<MkKeyValue
					v-if="handlers(plugin.id).length > 0"
					class="_formBlock"
				>
					<template #key>{{ i18n.ts._plugin.registeredHandlers }}</template>
					<template #value>
						<ul class="plugin-handlers">
							<li v-for="(h, i) in handlers(plugin.id)" :key="i">
								{{ handlerLabel(h) }}
							</li>
						</ul>
					</template>
				</MkKeyValue>

				<div
					v-if="plugin.config && Object.keys(plugin.config).length > 0"
					class="_formBlock plugin-settings-button"
				>
					<MkButton inline @click="openConfig(plugin)">
						<i class="ph-gear-six ph-bold ph-lg"></i>
						{{ i18n.ts.settings }}
					</MkButton>
				</div>

				<FormFolder class="_formBlock">
					<template #label>{{ i18n.ts._plugin.operations }}</template>
					<template #icon
						><i class="ph-wrench ph-bold ph-lg"></i
					></template>
					<div class="plugin-operations">
						<MkButton inline @click="reload(plugin)">
							<i class="ph-arrows-clockwise ph-bold ph-lg"></i>
							{{ i18n.ts.reload }}
						</MkButton>
						<MkButton inline @click="updateSource(plugin)">
							<i class="ph-pencil ph-bold ph-lg"></i>
							{{ i18n.ts._plugin.update }}
						</MkButton>
						<MkButton inline @click="exportPlugin(plugin)">
							<i class="ph-export ph-bold ph-lg"></i>
							{{ i18n.ts._plugin.export }}
						</MkButton>
						<MkButton
							v-if="plugin.permissions?.length"
							inline
							@click="reauthorize(plugin)"
						>
							<i class="ph-key ph-bold ph-lg"></i>
							{{ i18n.ts._plugin.reauthorize }}
						</MkButton>
						<MkButton inline danger @click="uninstall(plugin)">
							<i class="ph-trash ph-bold ph-lg"></i>
							{{ i18n.ts.uninstall }}
						</MkButton>
					</div>
				</FormFolder>

				<FormFolder class="_formBlock">
					<template #label>{{ i18n.ts._plugin.logs }}</template>
					<template #icon
						><i class="ph-terminal-window ph-bold ph-lg"></i
					></template>
					<div class="plugin-logs">
						<div
							v-for="(log, i) in logs(plugin.id)"
							:key="i"
							class="plugin-log"
							:class="{
								isSystemLog: log.isSystem,
								isErrorLog: log.isError,
							}"
						>
							<span class="plugin-log-time">{{
								timeToHhMmSs(log.at)
							}}</span>
							<span class="plugin-log-message">{{ log.message }}</span>
						</div>
						<div v-if="logs(plugin.id).length === 0" class="plugin-log-empty">
							{{ i18n.ts._plugin.noLogs }}
						</div>
					</div>
				</FormFolder>

				<FormFolder class="_formBlock">
					<template #label>{{ i18n.ts._plugin.viewSource }}</template>
					<template #icon
						><i class="ph-code ph-bold ph-lg"></i
					></template>
					<FormInfo
						v-if="isPluginLegacyAstOnly(plugin)"
						class="_formBlock"
					>
						{{ i18n.ts._plugin.sourceLegacyAst }}
					</FormInfo>
					<FormInfo
						v-else-if="isPluginSourceUnavailable(plugin)"
						class="_formBlock"
					>
						{{ i18n.ts._plugin.sourceEmpty }}
					</FormInfo>
					<MkCode
						v-else
						:code="getPluginSource(plugin)"
						lang="aiscript"
					/>
				</FormFolder>
			</div>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * インストール済み AiScript プラグインの管理画面。
 *
 * @remarks
 * mkkey 設定 UI 慣例（FormFolder / os.form）に合わせて構成する。
 *
 * @public
 */
import { onMounted, ref } from "vue";
import FormLink from "@/components/form/link.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSection from "@/components/form/section.vue";
import FormFolder from "@/components/form/folder.vue";
import FormInfo from "@/components/MkInfo.vue";
import MkButton from "@/components/MkButton.vue";
import MkKeyValue from "@/components/MkKeyValue.vue";
import MkCode from "@/components/MkCode.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import {
	authorizePlugin,
	changePluginActive,
	copyPluginSource,
	getPluginById,
	getPluginLangVersion,
	getPluginSource,
	getPlugins,
	isPluginLegacyAstOnly,
	isPluginSourceUnavailable,
	pluginHandlerRegistrations,
	pluginLaunchStatus,
	pluginLogs,
	reloadPlugin,
	savePluginConfig,
	uninstallPlugin,
	updatePluginSource,
	type Plugin,
	type PluginHandlerRegistration,
} from "@/plugin";

const plugins = ref<Plugin[]>(getPlugins());

function refreshPlugins(): void {
	plugins.value = getPlugins();
}

onMounted(() => {
	refreshPlugins();
});

function langVersion(plugin: Plugin): string | null {
	return getPluginLangVersion(plugin);
}

function launchStatus(id: string): string | undefined {
	return pluginLaunchStatus.value.get(id);
}

function logs(id: string) {
	return pluginLogs.value.get(id) ?? [];
}

function handlers(id: string): PluginHandlerRegistration[] {
	return pluginHandlerRegistrations.value.get(id) ?? [];
}

function permissionLabel(p: string): string {
	return (i18n.ts._permissions as Record<string, string>)?.[p] ?? p;
}

function handlerLabel(h: PluginHandlerRegistration): string {
	const typeLabels: Record<string, string> = {
		post_form_action: i18n.ts._plugin.handlerPostForm,
		user_action: i18n.ts._plugin.handlerUser,
		note_action: i18n.ts._plugin.handlerNote,
		note_view_interruptor: i18n.ts._plugin.handlerNoteView,
		note_post_interruptor: i18n.ts._plugin.handlerNotePost,
		page_view_interruptor: i18n.ts._plugin.handlerPageView,
	};
	const base = typeLabels[h.type] ?? h.type;
	return h.title ? `${base}: ${h.title}` : base;
}

function timeToHhMmSs(unixtime: number): string {
	return new Date(unixtime).toTimeString().split(" ")[0];
}

function reload(plugin: Plugin): void {
	reloadPlugin(plugin);
	os.success();
}

function changeActive(plugin: Plugin, active: boolean): void {
	changePluginActive(plugin, active);
	refreshPlugins();
}

/** プラグイン設定をポップアップで編集する（従来の mkkey 方式） */
async function openConfig(plugin: Plugin): Promise<void> {
	if (!plugin.config) return;

	// NOTE: os.form 用に default を configData で上書きしたコピーを渡す
	const form = JSON.parse(JSON.stringify(plugin.config)) as Record<
		string,
		{ default?: unknown }
	>;
	for (const key of Object.keys(form)) {
		form[key].default =
			typeof plugin.configData[key] !== "undefined"
				? plugin.configData[key]
				: form[key].default;
	}

	const { canceled, result } = (await os.form(
		plugin.name,
		form as never,
	)) as { canceled: boolean; result: Record<string, unknown> };
	if (canceled) return;

	savePluginConfig(plugin, result);
	const updated = getPluginById(plugin.id);
	if (updated) reloadPlugin(updated);
	refreshPlugins();
	os.success();
}

async function uninstall(plugin: Plugin): Promise<void> {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("removeAreYouSure", { x: plugin.name }),
	});
	if (canceled) return;
	await uninstallPlugin(plugin);
	refreshPlugins();
	os.success();
}

async function reauthorize(plugin: Plugin): Promise<void> {
	await authorizePlugin(plugin, true);
	refreshPlugins();
	const updated = getPluginById(plugin.id);
	if (updated) reloadPlugin(updated);
	os.success();
}

async function updateSource(plugin: Plugin): Promise<void> {
	const { canceled, result } = await os.inputParagraph({
		title: i18n.ts._plugin.update,
		text: i18n.ts._plugin.updateDescription,
		default: getPluginSource(plugin),
	});
	if (canceled || result == null) return;
	try {
		await updatePluginSource(plugin, result);
		refreshPlugins();
		os.success();
	} catch (e) {
		const msg =
			e instanceof Error && e.message === "nameMismatch"
				? i18n.ts._plugin.updateNameMismatch
				: String(e);
		os.alert({ type: "error", text: msg });
	}
}

async function exportPlugin(plugin: Plugin): Promise<void> {
	if (isPluginLegacyAstOnly(plugin)) {
		os.alert({ type: "error", text: i18n.ts._plugin.sourceLegacyAst });
		return;
	}
	if (isPluginSourceUnavailable(plugin)) {
		os.alert({ type: "error", text: i18n.ts._plugin.sourceEmpty });
		return;
	}

	const ok = await copyPluginSource(plugin);
	if (ok) {
		os.success();
	} else {
		os.alert({ type: "error", text: i18n.ts._plugin.copyFailed });
	}
}

const headerActions = $computed(() => []);
const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.plugins,
	icon: "ph-plug ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.plugin-card {
	padding: 1.25rem;
}

.plugin-card-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 0.75rem;
	margin-bottom: 0.5rem;
}

.plugin-version {
	opacity: 0.7;
	white-space: nowrap;
}

.plugin-lang-version {
	display: inline-block;
	margin-left: 0.5rem;
	font-size: 0.75em;
	opacity: 0.65;
}

.plugin-description {
	margin: 0 0 0.75rem;
	opacity: 0.85;
	font-size: 0.9em;
}

.plugin-error-badge {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	margin-bottom: 0.75rem;
	padding: 0.35rem 0.6rem;
	border-radius: 6px;
	background: var(--errorBg);
	color: var(--error);
	font-size: 0.85em;
}

.plugin-settings-button,
.plugin-operations {
	display: flex;
	flex-wrap: wrap;
	gap: var(--margin);
}

.plugin-permissions,
.plugin-handlers {
	margin: 0;
	padding-left: 1.25rem;
}

.plugin-logs {
	max-height: 240px;
	overflow-y: auto;
	font-family: var(--monospace);
	font-size: 0.85em;
}

.plugin-log {
	display: flex;
	gap: 0.5rem;
	padding: 0.15rem 0;
	word-break: break-all;
}

.plugin-log-time {
	opacity: 0.6;
	flex-shrink: 0;
}

.isSystemLog {
	opacity: 0.5;
}

.isErrorLog {
	color: var(--error);
}

.plugin-log-empty {
	opacity: 0.6;
	font-size: 0.9em;
}
</style>
