/**
 * @packageDocumentation
 *
 * マックマクド変換（設定「マック／マクド」）の英字表記で、大文字・小文字と全角・半角の状態を引き継ぐ。
 *
 * @remarks
 * ## 対応の考え方
 * makku を「ma ＋ k（っ）＋ ku」、makudo を「ma ＋ ku ＋ do」と見て、音のかたまりごとに対応させる。
 *
 * ```
 * makku:  m a  k    k u
 *              │    └┬┘
 * makudo: m a  k u  d o
 * ```
 *
 * makku → makudo
 * - m・a はそのまま。
 * - k は 1 つ目の k を引き継ぐ。
 * - 「do」は元の「ku」を引き継ぐ（d ← 2 つ目の k、o ← u）。
 * - 増える u は、1 つ目の k が大文字のときだけ考える。a と元の u が両方小文字なら小文字（Ku）、
 *   どちらかが大文字なら大文字（KU）。k が小文字なら常に小文字。
 *
 * makudo → makku（上の逆。増えた u は捨てる）
 * - m・a はそのまま、1 つ目の k ← k、2 つ目の k ← d、u ← o。
 *
 * この対応だと、行って戻すと元の形に戻る（maKku → maKudo → maKku）。
 *
 * | 元     | 変換後  |
 * | ------ | ------- |
 * | makku  | makudo  |
 * | Makku  | Makudo  |
 * | MAKKU  | MAKUDO  |
 * | maKku  | maKudo  |
 * | MaKku  | MaKudo  |
 * | maKKu  | maKuDo  |
 * | makkU  | makudO  |
 * | mAKku  | mAKUdo  |
 * | maKKU  | maKUDO  |
 * | makKU  | makuDO  |
 * | maKkU  | maKUdO  |
 *
 * 全角の英字（ｍａｋｋｕ）も対象。各文字は、対応する元の文字の全角・半角を引き継ぐ
 * （増える u は元の u に合わせる）。
 *
 * @public
 */

/**
 * 変換の対象にする正規表現（makku）
 *
 * @remarks
 * 半角・全角どちらの英字にも一致する。後ろに英字（半角・全角）が続く場合は別の単語とみなして変換しない。
 *
 * @public
 */
export const MAKKU_PATTERN =
	/[mｍ][aａ][kｋ][kｋ][uｕ](?![a-zA-Zａ-ｚＡ-Ｚ])/gi;

/**
 * 変換の対象にする正規表現（makudo）
 *
 * @remarks
 * {@link MAKKU_PATTERN} と同じく、半角・全角どちらにも一致する。
 *
 * @public
 */
export const MAKUDO_PATTERN =
	/[mｍ][aａ][kｋ][uｕ][dｄ][oｏ](?![a-zA-Zａ-ｚＡ-Ｚ])/gi;

/** 全角英字と半角英字のコードの差 */
const FULL_WIDTH_OFFSET = 0xfee0;

/**
 * 1 文字が大文字か（全角も判定できる）
 *
 * @param ch - 調べる文字
 * @returns 大文字なら true
 */
function isUpper(ch: string): boolean {
	return ch !== ch.toLowerCase();
}

/**
 * 1 文字が全角英字か
 *
 * @param ch - 調べる文字
 * @returns 全角なら true
 */
function isFullWidth(ch: string): boolean {
	const code = ch.codePointAt(0) ?? 0;
	return code >= 0xff21 && code <= 0xff5a;
}

/**
 * 半角の英小文字を、指定の大文字小文字・全角半角にする
 *
 * @param ch - 半角の英小文字
 * @param upper - 大文字にするなら true
 * @param fullWidth - 全角にするなら true
 * @returns 変えた文字
 */
function styled(ch: string, upper: boolean, fullWidth: boolean): string {
	const c = upper ? ch.toUpperCase() : ch;
	return fullWidth
		? String.fromCharCode(c.charCodeAt(0) + FULL_WIDTH_OFFSET)
		: c;
}

/**
 * 元の文字と同じ大文字小文字・全角半角で、指定の半角英小文字を書く
 *
 * @param ch - 書きたい半角の英小文字
 * @param src - 状態を写す元の文字
 * @returns 変えた文字
 */
function like(ch: string, src: string): string {
	return styled(ch, isUpper(src), isFullWidth(src));
}

/**
 * makku（大文字小文字・全角半角は問わない）を makudo に変える
 *
 * @param src - 一致した 5 文字（例: `Makku`）
 * @returns 状態を引き継いだ makudo（例: `Makudo`）
 *
 * @example
 * ```ts
 * toMakudo("mAKku"); // "mAKUdo"
 * ```
 *
 * @public
 */
export function toMakudo(src: string): string {
	const [m, a, k1, k2, u] = Array.from(src);
	// 増える u は、1 つ目の k が大文字で、a か元の u のどちらかが大文字なら大文字（Ku / KU）
	const addedUUpper = isUpper(k1) && (isUpper(a) || isUpper(u));
	return (
		like("m", m) +
		like("a", a) +
		like("k", k1) +
		styled("u", addedUUpper, isFullWidth(u)) +
		like("d", k2) +
		like("o", u)
	);
}

/**
 * makudo（大文字小文字・全角半角は問わない）を makku に変える
 *
 * @param src - 一致した 6 文字（例: `Makudo`）
 * @returns 状態を引き継いだ makku（例: `Makku`）
 *
 * @example
 * ```ts
 * toMakku("makuDO"); // "makKU"
 * ```
 *
 * @public
 */
export function toMakku(src: string): string {
	// 増えていた u（4 文字目）は使わない
	const [m, a, k, , d, o] = Array.from(src);
	return like("m", m) + like("a", a) + like("k", k) + like("k", d) + like("u", o);
}
