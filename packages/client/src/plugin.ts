/**
 * @packageDocumentation
 *
 * クライアントサイド AiScript プラグインの読み込み・実行・ライフサイクル管理。
 *
 * @remarks
 * - プラグインごとに `/// @` 注釈に応じた AiScript ランタイムを dynamic import する。
 * - TODO: `Plugin:open_settings` API でプラグイン独自の設定 UI を開けるようにする。
 *
 * @public
 */
import { defineAsyncComponent, ref } from "vue";
import type { Interpreter } from "@syuilo/aiscript";
import { utils as defaultUtils } from "@syuilo/aiscript";
import { v4 as uuid } from "uuid";
import { createAiScriptEnv } from "@/scripts/aiscript/api";
import {
	isSupportedAiscriptVersion,
	loadAiscriptRuntime,
	prepareScriptSource,
	resolveAiscriptKind,
	type AiscriptRuntime,
} from "@/scripts/aiscript/runtime";
import { inputText } from "@/os";
import * as os from "@/os";
import { i18n } from "@/i18n";
import {
	ColdDeviceStorage,
	noteActions,
	notePostInterruptors,
	noteViewInterruptors,
	pageViewInterruptors,
	postFormActions,
	userActions,
	type Plugin,
} from "@/store";

export type { Plugin } from "@/store";

/** プラグイン実行ログ1件 */
export type PluginLogEntry = {
	at: number;
	message: string;
	isSystem?: boolean;
	isError?: boolean;
};

/** プラグインが登録したハンドラ種別 */
export type PluginHandlerType =
	| "post_form_action"
	| "user_action"
	| "note_action"
	| "note_view_interruptor"
	| "note_post_interruptor"
	| "page_view_interruptor";

/** UI 表示用ハンドラ登録情報（B1） */
export type PluginHandlerRegistration = {
	type: PluginHandlerType;
	title?: string;
};

/** AiScript メタデータ解析結果 */
export type AiScriptPluginMeta = {
	name: string;
	version: string;
	author: string;
	description?: string;
	permissions?: string[];
	config?: Record<string, unknown>;
};

/** プラグイン ID ごとの実行コンテキスト */
type PluginContext = {
	interpreter: Interpreter;
	utils: AiscriptRuntime["utils"];
	values: AiscriptRuntime["values"];
};

const pluginContexts = new Map<string, PluginContext>();

/** プラグインごとの実行ログ（A2） */
export const pluginLogs = ref(new Map<string, PluginLogEntry[]>());

/** 起動状態（A8） */
export const pluginLaunchStatus = ref(
	new Map<string, "idle" | "running" | "ok" | "error">(),
);

/** 登録ハンドラ一覧（B1） */
export const pluginHandlerRegistrations = ref(
	new Map<string, PluginHandlerRegistration[]>(),
);

//#region ストレージヘルパー

/** インストール済みプラグイン一覧を取得する */
export function getPlugins(): Plugin[] {
	return ColdDeviceStorage.get("plugins");
}

/** プラグイン一覧を保存する */
export function savePlugins(plugins: Plugin[]): void {
	ColdDeviceStorage.set("plugins", plugins);
}

/** ID でプラグインを取得する */
export function getPluginById(id: string): Plugin | undefined {
	return getPlugins().find((p) => p.id === id);
}

/** プラグイン定義を部分更新する */
export function updatePluginRecord(
	id: string,
	patch: Partial<Plugin>,
): Plugin | undefined {
	const plugins = getPlugins();
	const index = plugins.findIndex((p) => p.id === id);
	if (index < 0) return undefined;
	plugins[index] = { ...plugins[index], ...patch };
	savePlugins(plugins);
	return plugins[index];
}

//#endregion

//#region メタデータ解析

/**
 * AiScript ソースからプラグインメタデータを解析する。
 *
 * @param code - プラグインソース
 * @throws 構文エラー・メタデータ不足・非対応バージョン
 * @public
 */
export async function parsePluginMeta(code: string): Promise<AiScriptPluginMeta> {
	if (!code?.trim()) {
		throw new Error("code is required");
	}

	const scriptVersion = defaultUtils.getLangVersion(code);
	if (scriptVersion == null) {
		throw new Error("noLangVersion");
	}
	if (!isSupportedAiscriptVersion(scriptVersion)) {
		throw new Error(`unsupportedVersion:${scriptVersion}`);
	}

	const runtime = await loadAiscriptRuntime(code);
	const kind = resolveAiscriptKind(code);
	const source = prepareScriptSource(code, kind);

	let ast;
	try {
		ast = new runtime.Parser().parse(source);
	} catch {
		throw new Error("syntaxError");
	}

	const meta = runtime.Interpreter.collectMetadata(ast);
	const metadata = meta?.get(null);
	if (metadata == null || typeof metadata !== "object") {
		throw new Error("noMetadata");
	}

	const { name, version, author, description, permissions, config } =
		metadata as Record<string, unknown>;
	if (name == null || version == null || author == null) {
		throw new Error("requiredProperty");
	}

	return {
		name: String(name),
		version: String(version),
		author: String(author),
		description: description != null ? String(description) : undefined,
		permissions: Array.isArray(permissions)
			? (permissions as string[])
			: undefined,
		config: config as Record<string, unknown> | undefined,
	};
}

/**
 * プラグインソースの AiScript 言語バージョンを取得する（A9）。
 *
 * @param plugin - プラグイン
 * @returns 注釈バージョン、なければ null
 * @public
 */
export function getPluginLangVersion(plugin: Plugin): string | null {
	if (!plugin.src) return null;
	return defaultUtils.getLangVersion(plugin.src);
}

//#endregion

//#region ログ・ハンドラ管理

function appendLog(
	pluginId: string,
	message: string,
	opts?: { isSystem?: boolean; isError?: boolean },
): void {
	const logs = pluginLogs.value.get(pluginId) ?? [];
	logs.push({ at: Date.now(), message, ...opts });
	pluginLogs.value.set(pluginId, [...logs]);
}

function systemLog(pluginId: string, message: string, isError = false): void {
	appendLog(pluginId, message, { isSystem: true, isError });
}

function registerHandlerMeta(
	pluginId: string,
	type: PluginHandlerType,
	title?: string,
): void {
	const list = [...(pluginHandlerRegistrations.value.get(pluginId) ?? [])];
	list.push({ type, title });
	pluginHandlerRegistrations.value.set(pluginId, list);
	systemLog(
		pluginId,
		`Handler registered: ${type}${title ? ` (${title})` : ""}`,
	);
}

function removePluginHandlers(pluginId: string): void {
	const filterByPlugin = <T extends { pluginId?: string }>(arr: T[]) => {
		for (let i = arr.length - 1; i >= 0; i--) {
			if (arr[i].pluginId === pluginId) arr.splice(i, 1);
		}
	};
	filterByPlugin(postFormActions);
	filterByPlugin(userActions);
	filterByPlugin(noteActions);
	filterByPlugin(noteViewInterruptors);
	filterByPlugin(notePostInterruptors);
	filterByPlugin(pageViewInterruptors);
	pluginHandlerRegistrations.value.delete(pluginId);
}

function clearPluginStorage(pluginId: string): void {
	for (const key of Object.keys(localStorage)) {
		if (key.startsWith(`aiscript:plugins:${pluginId}`)) {
			localStorage.removeItem(key);
		}
	}
}

//#endregion

//#region トークン（B2, A7）

/** gen-token 直後に i/apps から tokenId を解決する */
async function resolveTokenIdByName(name: string): Promise<string | null> {
	try {
		const apps = await os.api("i/apps", { sort: "+createdAt" });
		const match = apps.find((a: { name?: string }) => a.name === name);
		return match?.id ?? null;
	} catch {
		return null;
	}
}

/**
 * プラグイン権限用トークンを発行する（B2）。
 *
 * @param plugin - 対象プラグイン
 * @param force - true なら既存トークンがあっても再発行
 * @public
 */
export async function authorizePlugin(
	plugin: Plugin,
	force = false,
): Promise<void> {
	if (!plugin.permissions?.length) return;
	if (!force && plugin.token) return;

	const tokenInfo = await new Promise<{ token: string; tokenId: string | null }>(
		(res, rej) => {
			os.popup(
				defineAsyncComponent(
					() => import("@/components/MkTokenGenerateWindow.vue"),
				),
				{
					title: i18n.ts.tokenRequested,
					information: i18n.ts.pluginTokenRequestedDescription,
					initialName: plugin.name,
					initialPermissions: plugin.permissions,
				},
				{
					done: async (result: { name: string; permissions: string[] }) => {
						try {
							const { token } = await os.api("miauth/gen-token", {
								session: null,
								name: result.name,
								permission: result.permissions,
							});
							const tokenId = await resolveTokenIdByName(result.name);
							res({ token, tokenId });
						} catch (e) {
							rej(e);
						}
					},
				},
				"closed",
			);
		},
	);

	updatePluginRecord(plugin.id, {
		token: tokenInfo.token,
		tokenId: tokenInfo.tokenId,
	});
}

async function revokePluginToken(plugin: Plugin): Promise<void> {
	if (!plugin.tokenId) return;
	try {
		await os.api("i/revoke-token", { tokenId: plugin.tokenId });
	} catch {
		// NOTE: 既に失効済み等は無視
	}
}

//#endregion

//#region ライフサイクル

/**
 * 有効なプラグインをすべて起動する。
 *
 * @public
 */
export async function launchPlugins(): Promise<void> {
	await Promise.all(
		getPlugins()
			.filter((p) => p.active)
			.map((p) => launchPlugin(p.id)),
	);
}

/**
 * プラグインを起動する。
 *
 * @param id - プラグイン ID
 * @public
 */
export async function launchPlugin(id: string): Promise<void> {
	const plugin = getPluginById(id);
	if (!plugin?.active || !plugin.src?.trim()) return;

	// 再起動時にハンドラが二重登録されないよう、既存コンテキストを先に破棄する
	abortPlugin(plugin);

	pluginLogs.value.set(id, []);
	pluginHandlerRegistrations.value.set(id, []);
	pluginLaunchStatus.value.set(id, "running");

	systemLog(id, "Starting plugin...");

	try {
		await authorizePlugin(plugin);

		const current = getPluginById(id)!;
		const runtime = await loadAiscriptRuntime(current.src);
		const kind = resolveAiscriptKind(current.src);
		const source = prepareScriptSource(current.src, kind);

		const aiscript = new runtime.Interpreter(
			createPluginEnv(
				{ plugin: current, storageKey: `plugins:${current.id}` },
				runtime,
				id,
			),
			{
				in: (q) =>
					new Promise((ok) => {
						inputText({ title: q }).then(({ result: a }) => ok(a));
					}),
				out: (value) => {
					appendLog(id, runtime.utils.reprValue(value));
				},
				log: () => {},
				err: (err) => {
					appendLog(id, String(err), { isError: true });
					throw err;
				},
			},
		);

		pluginContexts.set(id, {
			interpreter: aiscript as Interpreter,
			utils: runtime.utils,
			values: runtime.values,
		});

		const parser = new runtime.Parser();
		await aiscript.exec(parser.parse(source));

		console.info("Plugin started:", current.name, `v${current.version}`);
		systemLog(id, "Plugin started");
		pluginLaunchStatus.value.set(id, "ok");
	} catch (err) {
		console.error("Plugin start failed:", plugin.name, err);
		systemLog(id, String(err), true);
		pluginLaunchStatus.value.set(id, "error");
	}
}

/**
 * プラグインを停止し、登録ハンドラを解除する。
 *
 * @param plugin - 対象プラグイン
 * @public
 */
export function abortPlugin(plugin: Plugin): void {
	const ctx = pluginContexts.get(plugin.id);
	if (ctx) {
		ctx.interpreter.abort();
		pluginContexts.delete(plugin.id);
	}
	removePluginHandlers(plugin.id);
	pluginLaunchStatus.value.set(plugin.id, "idle");
}

/**
 * プラグインを再起動する（A1）。
 *
 * @param plugin - 対象プラグイン
 * @public
 */
export function reloadPlugin(plugin: Plugin): void {
	abortPlugin(plugin);
	if (plugin.active) {
		void launchPlugin(plugin.id);
	}
}

/**
 * プラグイン設定を保存して再起動する（A4）。
 *
 * @param plugin - 対象プラグイン
 * @param configData - 新しい設定値
 * @public
 */
export function savePluginConfig(
	plugin: Plugin,
	configData: Record<string, unknown>,
): void {
	updatePluginRecord(plugin.id, { configData });
	const updated = getPluginById(plugin.id);
	if (updated) reloadPlugin(updated);
}

/**
 * 有効/無効を切り替える（A5）。
 *
 * @param plugin - 対象プラグイン
 * @param active - 有効にするか
 * @public
 */
export function changePluginActive(plugin: Plugin, active: boolean): void {
	updatePluginRecord(plugin.id, { active });
	const updated = getPluginById(plugin.id)!;
	if (active) {
		void launchPlugin(updated.id);
	} else {
		abortPlugin(updated);
	}
}

/**
 * プラグインをアンインストールする（A7）。
 *
 * @param plugin - 対象プラグイン
 * @public
 */
export async function uninstallPlugin(plugin: Plugin): Promise<void> {
	abortPlugin(plugin);
	await revokePluginToken(plugin);
	clearPluginStorage(plugin.id);
	savePlugins(getPlugins().filter((p) => p.id !== plugin.id));
	pluginLogs.value.delete(plugin.id);
	pluginLaunchStatus.value.delete(plugin.id);
	pluginHandlerRegistrations.value.delete(plugin.id);
}

/**
 * プラグインソースを更新する（B3）。
 *
 * @param plugin - 対象プラグイン
 * @param newSrc - 新しいソース
 * @public
 */
export async function updatePluginSource(
	plugin: Plugin,
	newSrc: string,
): Promise<void> {
	const meta = await parsePluginMeta(newSrc);
	if (meta.name !== plugin.name) {
		throw new Error("nameMismatch");
	}
	updatePluginRecord(plugin.id, {
		src: newSrc,
		version: meta.version,
		author: meta.author,
		description: meta.description,
		permissions: meta.permissions,
		config: meta.config,
	});
	const updated = getPluginById(plugin.id)!;
	reloadPlugin(updated);
}

/**
 * プラグインを新規インストールする（B5, B6）。
 *
 * @param code - AiScript ソース
 * @public
 */
export async function installPlugin(code: string): Promise<Plugin> {
	const meta = await parsePluginMeta(code);
	if (getPlugins().some((p) => p.name === meta.name)) {
		throw new Error("duplicate");
	}

	const id = uuid();
	const plugin: Plugin = {
		...meta,
		id,
		active: true,
		configData: {},
		src: code,
		token: null,
		tokenId: null,
	};

	savePlugins(getPlugins().concat(plugin));

	const saved = getPluginById(id)!;
	await authorizePlugin(saved);
	await launchPlugin(id);

	return getPluginById(id)!;
}

/**
 * @deprecated {@link launchPlugin} を使用してください
 * @public
 */
export async function install(plugin: Plugin): Promise<void> {
	await launchPlugin(plugin.id);
}

//#endregion

//#region AiScript 環境

function createPluginEnv(
	opts: { plugin: Plugin; storageKey: string },
	runtime: Pick<AiscriptRuntime, "utils" | "values">,
	pluginId: string,
) {
	const { utils, values } = runtime;
	const config = new Map<string, (typeof values)["Value"]>();
	for (const [k, v] of Object.entries(opts.plugin.config ?? {})) {
		const field = v as { default?: unknown };
		config.set(
			k,
			utils.jsToVal(
				typeof opts.plugin.configData[k] !== "undefined"
					? opts.plugin.configData[k]
					: field.default,
			),
		);
	}

	const registerPostForm = (title: string, handler: unknown) => {
		registerHandlerMeta(pluginId, "post_form_action", title);
		postFormActions.push({
			pluginId,
			title,
			handler: (form, update) => {
				const ctx = pluginContexts.get(pluginId);
				if (!ctx) return;
				ctx.interpreter.execFn(handler, [
					ctx.utils.jsToVal(form),
					ctx.values.FN_NATIVE(([key, value]) => {
						if (!key || !value) return;
						update(ctx.utils.valToJs(key), ctx.utils.valToJs(value));
					}),
				]);
			},
		});
	};

	const registerUser = (title: string, handler: unknown) => {
		registerHandlerMeta(pluginId, "user_action", title);
		userActions.push({
			pluginId,
			title,
			handler: (user) => {
				const ctx = pluginContexts.get(pluginId);
				if (!ctx) return;
				ctx.interpreter.execFn(handler, [ctx.utils.jsToVal(user)]);
			},
		});
	};

	const registerNote = (title: string, handler: unknown) => {
		registerHandlerMeta(pluginId, "note_action", title);
		noteActions.push({
			pluginId,
			title,
			handler: (note) => {
				const ctx = pluginContexts.get(pluginId);
				if (!ctx) return;
				ctx.interpreter.execFn(handler, [ctx.utils.jsToVal(note)]);
			},
		});
	};

	return {
		...createAiScriptEnv({ ...opts, token: opts.plugin.token }, runtime),
		//#region Deprecated
		"Mk:register_post_form_action": values.FN_NATIVE(([title, handler]) => {
			registerPostForm(title.value, handler);
		}),
		"Mk:register_user_action": values.FN_NATIVE(([title, handler]) => {
			registerUser(title.value, handler);
		}),
		"Mk:register_note_action": values.FN_NATIVE(([title, handler]) => {
			registerNote(title.value, handler);
		}),
		//#endregion
		"Plugin:register_post_form_action": values.FN_NATIVE(([title, handler]) => {
			registerPostForm(title.value, handler);
		}),
		"Plugin:register_user_action": values.FN_NATIVE(([title, handler]) => {
			registerUser(title.value, handler);
		}),
		"Plugin:register_note_action": values.FN_NATIVE(([title, handler]) => {
			registerNote(title.value, handler);
		}),
		"Plugin:register_note_view_interruptor": values.FN_NATIVE(([handler]) => {
			registerHandlerMeta(pluginId, "note_view_interruptor");
			noteViewInterruptors.push({
				pluginId,
				handler: async (note) => {
					const ctx = pluginContexts.get(pluginId);
					if (!ctx) return;
					return ctx.utils.valToJs(
						await ctx.interpreter.execFn(handler, [
							ctx.utils.jsToVal(note),
						]),
					);
				},
			});
		}),
		"Plugin:register_note_post_interruptor": values.FN_NATIVE(([handler]) => {
			registerHandlerMeta(pluginId, "note_post_interruptor");
			notePostInterruptors.push({
				pluginId,
				handler: async (note) => {
					const ctx = pluginContexts.get(pluginId);
					if (!ctx) return;
					return ctx.utils.valToJs(
						await ctx.interpreter.execFn(handler, [
							ctx.utils.jsToVal(note),
						]),
					);
				},
			});
		}),
		"Plugin:register_page_view_interruptor": values.FN_NATIVE(([handler]) => {
			registerHandlerMeta(pluginId, "page_view_interruptor");
			pageViewInterruptors.push({
				pluginId,
				handler: async (page) => {
					const ctx = pluginContexts.get(pluginId);
					if (!ctx) return;
					return ctx.utils.valToJs(
						await ctx.interpreter.execFn(handler, [
							ctx.utils.jsToVal(page),
						]),
					);
				},
			});
		}),
		"Plugin:open_url": values.FN_NATIVE(([url]) => {
			window.open(url.value, "_blank", "noopener");
		}),
		"Plugin:config": values.OBJ(config),
	};
}

//#endregion
