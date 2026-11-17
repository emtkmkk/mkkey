/**
 * @packageDocumentation
 *
 * お遊び機能「マクドナルドの短縮名」のクライアント側。本文の `$[mc]` を、見ている人の設定の短縮名で表示する。
 *
 * @remarks
 * - `$[mc]` / `$[mc ]` は MFM の関数として認識されない（中身が無い）ので、文字の部品の中から探す。
 * - `$[mc aaa]` は MFM の関数 `mc` として認識される。短縮名のすぐ後ろに中身を続ける。
 * - コードの中は置き換えない。
 * - ログインしていない・未設定なら「マック」。
 * - 表示した短縮名は、マックマクド変換（`replaceMakudo`）の対象にしない。
 *
 * NOTE: サーバー側の `packages/backend/src/misc/mc-short-name.ts` と同じ規則にしておくこと
 * （リモートへ送るときはサーバーが投稿者の設定で置き換える）。
 *
 * @public
 */
import { $i } from "@/account";

/** マクドナルドの 6 文字（自由に指定のときに 1 文字ずつ選ぶ） */
export const MC_FULL_NAME = ["マ", "ク", "ド", "ナ", "ル", "ド"] as const;

/** 未設定のときの短縮名 */
export const DEFAULT_MC_SHORT_NAME = "マック";

/**
 * 設定値から短縮名の文字列を求める
 *
 * @param setting - 設定値（`makku` / `makudo` / `free:xxxxxx`。未設定・不正なら「マック」）
 * @returns 短縮名
 * @public
 */
export function resolveMcShortName(setting: string | null | undefined): string {
	if (setting === "makudo") return "マクド";
	const free = /^free:([01]{6})$/.exec(setting ?? "");
	if (free && free[1] !== "000000") {
		return MC_FULL_NAME.filter((_, i) => free[1][i] === "1").join("");
	}
	return DEFAULT_MC_SHORT_NAME;
}

/**
 * ログイン中のユーザーの短縮名（`$[mc]` の表示に使う）
 *
 * @returns 短縮名
 * @public
 */
export function getMyMcShortName(): string {
	return resolveMcShortName($i?.mcShortName);
}

/**
 * 文字の中の `$[mc]` / `$[mc ]` / `$[mc aaa]`
 *
 * @remarks
 * `$[mc aaa]` はふつう MFM の関数として解析されるが、簡易表示（`parseSimple`）では関数を解析しないので文字のまま残る。
 * その場合もここで拾い、1 つ目の括弧で中身（aaa）を取り出す。
 */
const MC_TOKEN_PATTERN = /\$\[mc(?:\s+([^[\]]*?))?\s*\]/g;

/** 置き換えの区切りに使う文字（本文に現れない制御文字） */
const SEPARATOR = "\u0000";

/**
 * 文字の中の `$[mc]` を短縮名にする
 *
 * @remarks
 * 短縮名の前後の文字にだけ `decorate`（モールス解読・マックマクド変換など）を当て、短縮名自体には当てない。
 * `$[mc aaa]` の中身（aaa）は、短縮名のすぐ後ろに続くふつうの文字として扱う。
 *
 * @param text - 文字
 * @param decorate - 短縮名以外の文字に当てる変換
 * @returns 置き換えた文字
 * @public
 */
export function replaceMcTokens(
	text: string,
	decorate: (text: string) => string = (t) => t,
): string {
	if (!text.includes("$[mc")) return decorate(text);
	return text
		.replace(MC_TOKEN_PATTERN, (_, content: string | undefined) => SEPARATOR + (content ?? ""))
		.split(SEPARATOR)
		.map(decorate)
		.join(getMyMcShortName());
}
