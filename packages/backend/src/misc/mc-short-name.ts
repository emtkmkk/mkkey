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
 * - `free:xxxxxxx` … マ・ッ・ク・ド・ナ・ル・ドの 7 文字それぞれを使うか（1 / 0）。
 *   全部 0 は不可。「ッ」は「マ」と一緒にしか使えない（ッ だけ・ッで始まる短縮名は作れない）。
 * - `free:xxxxxx`（6 桁）… 以前の形（マ・ク・ド・ナ・ル・ド）。読むときは「ッ」なしの 7 桁として扱う。
 *
 * NOTE: クライアントの `packages/client/src/scripts/mc-short-name.ts` と同じ規則にしておくこと。
 *
 * @public
 */
import * as mfm from "mfm-js";

/** マックドナルドの 7 文字（自由に指定のときに 1 文字ずつ選ぶ） */
export const MC_FULL_NAME = ["マ", "ッ", "ク", "ド", "ナ", "ル", "ド"] as const;

/** 未設定のときの短縮名 */
export const DEFAULT_MC_SHORT_NAME = "マック";

/**
 * 保存できる設定値の形（`i/update` の入力の確認に使う）
 *
 * @remarks
 * `free:` は 7 桁の 0 / 1。全部 0 と、「ッ」だけオンで「マ」がオフ（先頭 2 桁が `01`）は不可。
 *
 * @public
 */
export const MC_SHORT_NAME_SETTING_PATTERN =
	"^(makku|makudo|free:(?!0000000)(?:1[01]|00)[01]{5})$";

/**
 * 設定値を、7 桁の `free:` か `makku` / `makudo` にそろえる
 *
 * @param setting - 設定値
 * @returns そろえた値。不正な値なら null
 */
function normalizeSetting(setting: string | null | undefined): string | null {
	if (setting == null) return null;
	// 以前の 6 桁（ッ なし）は、2 文字目に「ッ = 0」を足して 7 桁にする
	const legacy = /^free:([01])([01]{5})$/.exec(setting);
	const value = legacy ? `free:${legacy[1]}0${legacy[2]}` : setting;
	return new RegExp(MC_SHORT_NAME_SETTING_PATTERN).test(value) ? value : null;
}

/**
 * 設定値から短縮名の文字列を求める
 *
 * @param setting - 設定値（未設定・不正な値なら {@link DEFAULT_MC_SHORT_NAME}）
 * @returns 短縮名
 * @public
 */
export function resolveMcShortName(setting: string | null | undefined): string {
	const value = normalizeSetting(setting);
	if (value == null) return DEFAULT_MC_SHORT_NAME;
	if (value === "makku") return "マック";
	if (value === "makudo") return "マクド";
	const bits = value.slice("free:".length);
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
