/**
 * @packageDocumentation
 *
 * 検索用にタグ文字列を正規化する（NFKC + 小文字化）。
 *
 * @remarks
 * - **役割**: ハッシュタグ検索・タグ一致で、表記ゆれを吸収するために正規化する。
 * - 参考:
 * - https://analytics-note.xyz/programming/unicode-normalization-forms/
 * - https://maku77.github.io/js/string/normalize.html
 *
 * @internal
 */
/**
 * タグを検索用に正規化する（NFKC + 小文字）。
 * @param tag - 対象文字列
 * @returns 正規化後の文字列
 * @internal
 */
export function normalizeForSearch(tag: string): string {
	return tag.normalize("NFKC").toLowerCase();
}
