/**
 * @packageDocumentation
 *
 * AiScript スクリプト先頭の `/// @ x.y.z` に応じて、実行用ランタイムを選択する。
 *
 * @remarks
 * - 注釈なし / `0.12.0`〜`< 1.0.0` → `@syuilo/aiscript`（0.19.x）
 * - `< 0.12.0` → `@syuilo/aiscript-0-11-1`
 * - `>= 1.0.0` → `@syuilo/aiscript-1`
 *
 * @public
 */
import { utils as defaultUtils } from "@syuilo/aiscript";
import { compareVersions } from "compare-versions";
import { adaptAncientRuntime } from "./ancient-adapter";

/** ロード済み AiScript ランタイムモジュール */
export type AiscriptRuntime = {
	Interpreter: typeof import("@syuilo/aiscript").Interpreter;
	Parser: typeof import("@syuilo/aiscript").Parser;
	utils: typeof import("@syuilo/aiscript").utils;
	values: typeof import("@syuilo/aiscript").values;
};

/** ランタイム種別 */
export type AiscriptRuntimeKind = "default" | "ancient" | "legacy" | "modern";

/**
 * スクリプト注釈からランタイム種別を決定する。
 *
 * @param script - AiScript ソース
 * @returns 種別（注釈なしは default = 0.19.x）
 * @public
 */
export function resolveAiscriptKind(script: string): AiscriptRuntimeKind {
	const version = defaultUtils.getLangVersion(script);
	if (version == null) return "default";
	try {
		if (compareVersions(version, "1.0.0") >= 0) return "modern";
		if (compareVersions(version, "0.12.0") < 0) return "ancient";
		return "legacy";
	} catch {
		return "default";
	}
}

/**
 * 注釈付きプラグイン等でサポート対象のバージョンか判定する。
 *
 * @param version - `getLangVersion` の戻り値
 * @returns 対応 RT が存在する場合 true
 * @public
 */
export function isSupportedAiscriptVersion(version: string): boolean {
	try {
		// 0.11.x / 0.12+ / 1.x いずれも loadAiscriptRuntime でルーティング可能
		if (compareVersions(version, "0.11.0") >= 0) return true;
		return false;
	} catch {
		return false;
	}
}

/**
 * スクリプトに応じた AiScript ランタイムを dynamic import する。
 *
 * @param script - AiScript ソース
 * @returns Interpreter / Parser / utils / values
 * @public
 */
export async function loadAiscriptRuntime(
	script: string,
): Promise<AiscriptRuntime> {
	const kind = resolveAiscriptKind(script);
	if (kind === "ancient") {
		const mod = await import("@syuilo/aiscript-0-11-1");
		return adaptAncientRuntime(mod as never);
	}
	if (kind === "modern") {
		return import("@syuilo/aiscript-1") as Promise<AiscriptRuntime>;
	}
	// default / legacy → 本体 0.19.x
	return import("@syuilo/aiscript") as Promise<AiscriptRuntime>;
}

/**
 * 先頭の `/// @ x.y.z` 行を除去する（0.11.x パーサーはこの行を解釈できない）。
 *
 * @param script - AiScript ソース
 * @returns 除去後のソース
 * @public
 */
export function stripLangVersionLine(script: string): string {
	if (defaultUtils.getLangVersion(script) == null) return script;
	return script.replace(/^\s*\/\/\/\s*@\s*[A-Z0-9_.-]+(?:\r?\n|\r|\n)?/i, "");
}

/**
 * ランタイム種別に応じてパース用ソースを整える。
 *
 * @param script - 元ソース
 * @param kind - {@link resolveAiscriptKind} の結果
 * @public
 */
export function prepareScriptSource(
	script: string,
	kind: AiscriptRuntimeKind,
): string {
	return kind === "ancient" ? stripLangVersionLine(script) : script;
}

/**
 * Ui: API を注入可能か（0.16+ / topCall 前提の ancient 以外）。
 *
 * @param script - AiScript ソース
 * @public
 */
export function supportsUiLib(script: string): boolean {
	return resolveAiscriptKind(script) !== "ancient";
}
