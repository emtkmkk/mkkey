/**
 * @packageDocumentation
 *
 * 表示名をプレーンテキストとして扱うためのユーティリティ。
 *
 * @remarks
 * - **役割**: `:shortcode:` 形式のカスタム絵文字表記を取り除いた表示名を組み立てる。
 *   OGP の title や description のように、MFM やカスタム絵文字を解釈できない場所で使う。
 * - もともと `server/web/index.ts` に同じ式が 4 箇所インラインで重複していたものを切り出した。
 *
 * @internal
 */

/** 表示名の一部として最低限必要なフィールド */
export type UserNameSource = {
	name: string | null;
	username: string;
	host: string | null;
};

/**
 * 表示名から `:shortcode:` 形式のカスタム絵文字表記を取り除く。
 *
 * @remarks
 * 直前の半角スペースも一緒に消す。`たこ :kawaii:` が `たこ ` のように末尾へ
 * 空白を残さないようにするため。
 *
 * @param name - 元の表示名
 * @returns 絵文字表記を除いた文字列（前後の空白は整えない）
 */
export function stripEmojiShortcodes(name: string): string {
	return name.replaceAll(/ ?:.*?:/g, "");
}

/**
 * meta タグ向けに、絵文字表記を除いた表示名を返す。リモートならホストも付ける。
 *
 * @remarks
 * 絵文字を取り除いた結果が空になる（表示名が絵文字だけだった）場合は
 * `@username` へフォールバックする。
 *
 * @param user - 対象ユーザー
 * @returns `表示名@host` または `@username@host`
 */
export function getUserNameForMeta(user: UserNameSource): string {
	const suffix = user.host ? `@${user.host}` : "";
	const stripped = user.name ? stripEmojiShortcodes(user.name) : "";
	return stripped.trim() ? `${stripped}${suffix}` : `@${user.username}${suffix}`;
}
