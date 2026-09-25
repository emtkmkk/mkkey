/**
 * @packageDocumentation
 *
 * 絵文字の検索で、名前以外に照合する言葉（タグと読み）を返すヘルパー。
 *
 * @remarks
 * 読み（ruby）はタグ（aliases）とは別の項目として保存しているが、検索ではタグと同じように扱う。
 * タグの配列に読みを混ぜて保存すると、編集画面で読みがタグとして保存し直されてしまうため、検索のときだけ足す。
 *
 * @internal
 */

/** 検索対象の言葉を持つ絵文字（カスタム絵文字・Unicode 絵文字のどちらでもよい） */
type EmojiWithSearchWords = {
	aliases?: string[] | null;
	keywords?: string[] | null;
	ruby?: string | null;
};

/**
 * 絵文字の検索で照合する言葉を返す。
 *
 * @param emoji - カスタム絵文字（aliases / ruby）または Unicode 絵文字（keywords）
 * @returns タグ（無ければ keywords）に、読みがあれば足した配列
 * @internal
 */
export function getEmojiSearchWords(emoji: EmojiWithSearchWords): string[] {
	const base = emoji.aliases || emoji.keywords || [];
	return emoji.ruby ? [...base, emoji.ruby] : base;
}
