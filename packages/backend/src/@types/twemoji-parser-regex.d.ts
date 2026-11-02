/**
 * @twemoji/parser が内部で持つ絵文字の正規表現モジュールの型宣言。
 *
 * @remarks
 * パッケージ公式の型は `@twemoji/parser` 本体にしか付いておらず、
 * `dist/lib/regex.js` を直接 import する misc/emoji-regex.ts からは解決できない。
 * CommonJS 出力なので `default` に RegExp が入る形で宣言する。
 *
 * @internal
 */
declare module "@twemoji/parser/dist/lib/regex.js" {
	const regex: { default: RegExp };
	export default regex;
}
