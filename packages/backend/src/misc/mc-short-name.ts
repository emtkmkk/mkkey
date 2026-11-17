/**
 * @packageDocumentation
 *
 * お遊び機能「マクドナルドの短縮名」。本文中の `$[mc]` を、短縮名（マック・マクドなど）に置き換える。
 *
 * @remarks
 * ## 書き方
 * - `$[mc]` / `$[mc ]` … 短縮名だけ。MFM の関数としては中身が無いので認識されず、ただの文字になる。
 *   そのため、ふつうの文字の部品（MFM の `text` ノード）の中から探して置き換える。
 * - `$[mc aaa]` … MFM の関数として認識される。短縮名のすぐ後ろに中身（aaa）を続ける。
 * - コード（インライン・ブロック）の中はふつうの文字の部品ではないので置き換えない。
 * - NOTE: 別の関数の中に `$[mc]` を書く（`$[x2 $[mc]]`）と、`$[mc]` の `]` が外側の関数の終わりとして
 *   解析されてしまい置き換わらない。外側の関数を中身付きの `$[mc]` で包む形（`$[mc $[x2 行こ]]`）なら使える。
 *
 * ## 誰の設定で置き換えるか
 * - もこきーの画面では、見ている人の設定で置き換える（クライアントの `scripts/mc-short-name.ts`）。
 * - リモートへの配送・RSS・リンクのプレビューなど外へ出すときは、投稿者の設定で置き換える（このファイル）。
 * - 本文は `$[mc]` のまま保存する。
 *
 * ## 設定値（`user.mcShortName`）
 * - `null` … 未設定（{@link DEFAULT_MC_SHORT_NAME}）
 * - `makku` … マック
 * - `makudo` … マクド
 * - `free:xxxxxx` … マ・ク・ド・ナ・ル・ドの 6 文字それぞれを使うか（1 / 0）。全部 0 は不可。
 *
 * NOTE: クライアントの `packages/client/src/scripts/mc-short-name.ts` と同じ規則にしておくこと。
 *
 * @public
 */
import * as mfm from "mfm-js";

/** マクドナルドの 6 文字（自由に指定のときに 1 文字ずつ選ぶ） */
export const MC_FULL_NAME = ["マ", "ク", "ド", "ナ", "ル", "ド"] as const;

/** 未設定のときの短縮名 */
export const DEFAULT_MC_SHORT_NAME = "マック";

/**
 * 設定値として受け付ける形
 *
 * @remarks
 * `free:` は 6 桁の 0 / 1。全部 0（0 文字）は {@link isValidMcShortNameSetting} で弾く。
 *
 * @public
 */
export const MC_SHORT_NAME_SETTING_PATTERN = /^(makku|makudo|free:[01]{6})$/;

/**
 * 設定値が正しい形か
 *
 * @param value - 設定値
 * @returns 正しければ true
 * @public
 */
export function isValidMcShortNameSetting(value: string): boolean {
	return MC_SHORT_NAME_SETTING_PATTERN.test(value) && value !== "free:000000";
}

/**
 * 設定値から短縮名の文字列を求める
 *
 * @param setting - 設定値（未設定・不正な値なら {@link DEFAULT_MC_SHORT_NAME}）
 * @returns 短縮名
 * @public
 */
export function resolveMcShortName(setting: string | null | undefined): string {
	if (setting == null || !isValidMcShortNameSetting(setting)) {
		return DEFAULT_MC_SHORT_NAME;
	}
	if (setting === "makku") return "マック";
	if (setting === "makudo") return "マクド";
	const bits = setting.slice("free:".length);
	return MC_FULL_NAME.filter((_, i) => bits[i] === "1").join("");
}

/** 文字の部品の中の `$[mc]` / `$[mc ]` */
const MC_TOKEN = /\$\[mc\s*\]/g;

/**
 * MFM の部品の並びの `$[mc]` を短縮名に置き換える（並びをその場で作り直す）
 *
 * @param nodes - 部品の並び
 * @param shortName - 短縮名
 * @returns 置き換えた並び
 */
function transformNodes(nodes: mfm.MfmNode[], shortName: string): mfm.MfmNode[] {
	const result: mfm.MfmNode[] = [];
	for (const node of nodes) {
		if (node.type === "text") {
			const text = node.props.text.replace(MC_TOKEN, shortName);
			result.push(mfm.TEXT(text));
			continue;
		}
		if (node.type === "fn" && node.props.name === "mc") {
			// $[mc aaa] … 短縮名のすぐ後ろに中身を続ける
			result.push(mfm.TEXT(shortName), ...transformNodes(node.children, shortName));
			continue;
		}
		if ("children" in node && Array.isArray(node.children)) {
			(node as { children: mfm.MfmNode[] }).children = transformNodes(
				node.children,
				shortName,
			);
		}
		result.push(node);
	}
	return result;
}

/**
 * 本文の `$[mc]` / `$[mc aaa]` を短縮名に置き換える
 *
 * @remarks
 * `$[mc` を含まない本文はそのまま返す（ほとんどの投稿は解析しない）。
 * 置き換えは MFM として解析した上で行い、`mfm.toString` で文字に戻す。
 *
 * @param text - 本文（MFM）
 * @param shortName - 短縮名
 * @returns 置き換えた本文
 *
 * @example
 * ```ts
 * applyMcShortName("$[mc]行こ", "マクド"); // "マクド行こ"
 * applyMcShortName("$[mc 行こ]", "マック"); // "マック行こ"
 * ```
 *
 * @public
 */
export function applyMcShortName(text: string, shortName: string): string;
export function applyMcShortName(
	text: string | null | undefined,
	shortName: string,
): string | null | undefined;
export function applyMcShortName(
	text: string | null | undefined,
	shortName: string,
): string | null | undefined {
	if (text == null || !text.includes("$[mc")) return text;
	return mfm.toString(transformNodes(mfm.parse(text), shortName));
}
