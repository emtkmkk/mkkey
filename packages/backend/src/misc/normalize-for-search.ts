/**
 * @packageDocumentation
 *
 * 検索用にタグ文字列を正規化する（NFKC + 小文字化）。
 *
 * @remarks
 * - **役割**: ハッシュタグ検索・タグ一致で、表記ゆれを吸収するために正規化する。
 * - 保存側（ノート・プロフィールのタグ）と検索側（API・ストリーム）の両方がこの関数を通るので、
 *   挙動を変えるときは両方の結果が一致し続けることを確認する。
 * - 参考:
 * - https://analytics-note.xyz/programming/unicode-normalization-forms/
 * - https://maku77.github.io/js/string/normalize.html
 *
 * @internal
 */

/**
 * NFKC 正規化を行う入力の最大長（UTF-16 code unit 数）。
 *
 * @remarks
 * GHSA-qvv8-c4p9-h5xv 対策: NFKC 正規化は、結合文字（アクセント記号など）が続く入力で
 * 長さの 2 乗に比例して重くなる（手元の計測で 10 万字 2.3 秒）。`hashtags/show` などは
 * ログインなしで呼べるので、長いタグを送るだけで web ワーカーのイベントループを止められた。
 * ハッシュタグとして意味があるのは 128 文字（code point）程度までなので、
 * サロゲートペアを考慮して 2 倍を上限とし、それを超える入力は正規化を省く（本家 Misskey 2026.10.1 と同じ値）。
 *
 * @internal
 */
const MAX_NORMALIZE_LENGTH = 128 * 2;

/**
 * タグを検索用に正規化する（NFKC + 小文字）。
 *
 * @remarks
 * NB: {@link MAX_NORMALIZE_LENGTH} を超える入力は小文字化だけを行う（NFKC は省く）。
 * タグ以外の長い文字列（ノート本文など）には使わないこと。
 *
 * @param tag - 対象文字列
 * @returns 正規化後の文字列
 * @internal
 */
export function normalizeForSearch(tag: string): string {
	// 長すぎる入力は正規化の負荷が大きいので省く（上の定数の説明を参照）
	if (tag.length > MAX_NORMALIZE_LENGTH) {
		return tag.toLowerCase();
	}

	return tag.normalize("NFKC").toLowerCase();
}
