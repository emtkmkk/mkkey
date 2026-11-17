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
 * 設定値は `makku` / `makudo` / `free:xxxxxxx`（マ・ッ・ク・ド・ナ・ル・ドの 7 文字それぞれを使うか）。
 * 「ッ」は「マ」と一緒にしか使えない。以前の 6 桁の `free:`（ッ なし）も読める。
 *
 * NOTE: サーバー側の `packages/backend/src/misc/mc-short-name.ts` と同じ規則にしておくこと
 * （リモートへ送るときはサーバーが投稿者の設定で置き換える）。
 *
 * @public
 */
import { $i } from "@/account";

/** マックドナルドの 7 文字（自由に指定のときに 1 文字ずつ選ぶ） */
export const MC_FULL_NAME = ["マ", "ッ", "ク", "ド", "ナ", "ル", "ド"] as const;

/** 「マ」と「ッ」の位置（ッ は マ と一緒にしか使えない） */
export const MC_INDEX_MA = 0;
export const MC_INDEX_SMALL_TSU = 1;

/** 未設定のときの短縮名 */
export const DEFAULT_MC_SHORT_NAME = "マック";

/** 自由に指定に初めて切り替えたときの選択（マック） */
export const DEFAULT_MC_LETTER_BITS = [true, true, true, false, false, false, false];

/**
 * `free:` の設定値を 7 文字分のオンオフにする
 *
 * @param setting - 設定値
 * @returns オンオフの並び。`free:` でない・不正なら null
 * @public
 */
export function parseMcLetterBits(setting: string | null | undefined): boolean[] | null {
	const m7 = /^free:([01]{7})$/.exec(setting ?? "");
	// 以前の 6 桁（ッ なし）は、2 文字目に「ッ = オフ」を足す
	const m6 = /^free:([01])([01]{5})$/.exec(setting ?? "");
	const bits = m7 ? m7[1] : m6 ? `${m6[1]}0${m6[2]}` : null;
	if (bits == null) return null;
	const result = Array.from(bits).map((b) => b === "1");
	// 0 文字や「ッ」だけの不正な値は使わない
	if (!result.some(Boolean)) return null;
	if (result[MC_INDEX_SMALL_TSU] && !result[MC_INDEX_MA]) return null;
	return result;
}

/**
 * 設定値から短縮名の文字列を求める
 *
 * @param setting - 設定値（未設定・不正なら「マック」）
 * @returns 短縮名
 * @public
 */
export function resolveMcShortName(setting: string | null | undefined): string {
	if (setting === "makudo") return "マクド";
	const bits = parseMcLetterBits(setting);
	if (bits) return MC_FULL_NAME.filter((_, i) => bits[i]).join("");
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
