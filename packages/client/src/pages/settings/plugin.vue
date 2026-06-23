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

				<div class="plugin-actions-top">
					<MkButton inline @click="reload(plugin)">
						<i class="ph-arrows-clockwise ph-bold ph-lg"></i>
						{{ i18n.ts.reload }}
					</MkButton>
					<MkButton
						v-if="plugin.config && Object.keys(plugin.config).length > 0"
						inline
						@click="saveConfig(plugin)"
					>
						<i class="ph-floppy-disk ph-bold ph-lg"></i>
						{{ i18n.ts._plugin.saveConfig }}
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

				<MkPluginConfigForm
					v-if="plugin.config && Object.keys(plugin.config).length > 0"
					class="_formBlock"
					:form="plugin.config"
					:model-value="configDrafts[plugin.id]"
					@update:model-value="configDrafts[plugin.id] = $event"
				/>

				<MkFolder class="_formBlock" :expanded="false">
					<template #header>{{ i18n.ts._plugin.logs }}</template>
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
				</MkFolder>

				<MkFolder class="_formBlock" :expanded="false">
					<template #header>{{ i18n.ts._plugin.viewSource }}</template>
					<MkCode :code="plugin.src" lang="aiscript" />
				</MkFolder>
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
 * Misskey 本家同様、一覧カード内の折りたたみでログ・ソースを表示する。
 *
 * @public
 */
import { reactive, ref } from "vue";
import FormLink from "@/components/form/link.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSection from "@/components/form/section.vue";
import FormInfo from "@/components/MkInfo.vue";
import MkButton from "@/components/MkButton.vue";
import MkKeyValue from "@/components/MkKeyValue.vue";
import MkFolder from "@/components/MkFolder.vue";
import MkCode from "@/components/MkCode.vue";
import MkPluginConfigForm from "@/components/MkPluginConfigForm.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import {
	authorizePlugin,
	changePluginActive,
	getPluginLangVersion,
	getPlugins,
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
const configDrafts = reactive<Record<string, Record<string, unknown>>>({});

function initConfigDrafts(): void {
	for (const plugin of plugins.value) {
		if (!configDrafts[plugin.id]) {
			configDrafts[plugin.id] = buildConfigDraft(plugin);
		}
	}
}

function buildConfigDraft(plugin: Plugin): Record<string, unknown> {
	const draft: Record<string, unknown> = {};
	if (!plugin.config) return draft;
	for (const key of Object.keys(plugin.config)) {
		const field = plugin.config[key] as { default?: unknown };
		draft[key] =
			typeof plugin.configData[key] !== "undefined"
				? plugin.configData[key]
				: (field.default ?? null);
	}
	return draft;
}

function refreshPlugins(): void {
	plugins.value = getPlugins();
	initConfigDrafts();
}

initConfigDrafts();

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

function saveConfig(plugin: Plugin): void {
	savePluginConfig(plugin, configDrafts[plugin.id] ?? {});
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
	reloadPlugin(getPlugins().find((p) => p.id === plugin.id)!);
	os.success();
}

async function updateSource(plugin: Plugin): Promise<void> {
	const { canceled, result } = await os.inputParagraph({
		title: i18n.ts._plugin.update,
		text: i18n.ts._plugin.updateDescription,
		default: plugin.src,
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

function exportPlugin(plugin: Plugin): void {
	copyToClipboard(plugin.src);
	os.success();
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

.plugin-actions-top {
	display: flex;
	flex-wrap: wrap;
	gap: var(--margin);
	margin-bottom: 0.75rem;
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
