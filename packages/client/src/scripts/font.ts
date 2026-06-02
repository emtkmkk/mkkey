/**
 * @packageDocumentation
 *
 * クライアントのカスタムフォント定義モジュール。
 *
 * @remarks
 * - {@link fontList} はユーザーが設定 UI から選択できる日本語フォントの一覧。
 *   オブジェクトの定義順 = 設定画面の表示順となる({@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/entries | Object.entries} 仕様)。
 * - 各エントリのキーは `store.customFont` に保存される識別子。kebab-case を慣例とする。
 * - `importUrl` には Google Fonts の CSS URL もしくは自前ホストの `@font-face` を含む CSS URL を指定する。
 *   自前ホスト系の CSS とバイナリは `packages/backend/assets/fonts/` に同梱されており、
 *   `https://mkkey.net/static-assets/fonts/` 経由で配信される(例: `HuiFontP109.woff` / `NekoSpoon.woff2`)。
 * - フォント名(`name`)はそのまま UI に表示されるため、i18n は不要。
 *
 * NOTE: `applyFont()` は `fontList` にないキーが渡された場合、Google Fonts URL を自動生成する
 *       フォールバックを持っている。これにより、リストに無いフォント名でも CSS 経由で読み込める。
 *
 * @public
 */

export const fontList = {
	"noto-sans": {
		name: "Noto Sans JP",
		fontFamily: "Noto Sans JP",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap",
	},
	"noto-serif": {
		name: "明朝",
		fontFamily: "Noto Serif JP",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Noto+Serif+JP&display=swap",
	},
	"sawarabi Gothic": {
		name: "さわらびゴシック",
		fontFamily: "Sawarabi Gothic",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Sawarabi+Gothic&display=swap",
	},
	"sawarabi Mincho": {
		name: "さわらび明朝",
		fontFamily: "Sawarabi Mincho",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Sawarabi+Mincho&display=swap",
	},
	"m-plus": {
		name: "M PLUS 1p",
		fontFamily: "M PLUS 1p",
		importUrl:
			"https://fonts.googleapis.com/css2?family=M+PLUS+1p&display=swap",
	},
	"m-plus-rounded": {
		name: "M PLUS Rounded 1c",
		fontFamily: "M PLUS Rounded 1c",
		importUrl:
			"https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c&display=swap",
	},
	"m-plus-2": {
		name: "M PLUS 2",
		fontFamily: "M PLUS 2",
		importUrl: "https://fonts.googleapis.com/css2?family=M+PLUS+2&display=swap",
	},
	// NOTE: ねこスプーンは M+ -> ロゴたいぷゴシック派生のフリーフォント(SIL OFL 1.1)。
	//       M+ ファミリーの末尾に並べることで派生関係を反映している。
	//       バイナリと OFL ライセンス本文は packages/backend/assets/fonts/ に同梱。
	"neko-spoon": {
		name: "ねこスプーン",
		fontFamily: "ねこスプーン",
		importUrl: "https://mkkey.net/static-assets/fonts/nekospoon.css",
	},
	kosugi: {
		name: "小杉",
		fontFamily: "Kosugi",
		importUrl: "https://fonts.googleapis.com/css2?family=Kosugi&display=swap",
	},
	"kosugi-maru": {
		name: "小杉丸ゴシック",
		fontFamily: "Kosugi Maru",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap",
	},
	"kiwi-maru": {
		name: "キウイ丸",
		fontFamily: "Kiwi Maru",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Kiwi+Maru&display=swap",
	},
	"biz-udpgothic": {
		name: "BIZ UDゴシック",
		fontFamily: "BIZ UDPGothic",
		importUrl:
			"https://fonts.googleapis.com/css2?family=BIZ+UDPGothic&display=swap",
	},
	"biz-udmincho": {
		name: "BIZ UD明朝",
		fontFamily: "BIZ UDMincho",
		importUrl:
			"https://fonts.googleapis.com/css2?family=BIZ+UDMincho&display=swap",
	},
	"new-tegomin": {
		name: "テゴミン",
		fontFamily: "New Tegomin",
		importUrl:
			"https://fonts.googleapis.com/css2?family=New+Tegomin&display=swap",
	},
	Yomogi: {
		name: "よもぎフォント",
		fontFamily: "Yomogi",
		importUrl: "https://fonts.googleapis.com/css2?family=Yomogi&display=swap",
	},
	nukamiso: {
		name: "ぬかみそフォント",
		fontFamily: "ぬかみそフォント",
		importUrl: "https://mkkey.net/static-assets/fonts/nukamiso.css",
	},
	bokutatino: {
		name: "ぼくたちのゴシック",
		fontFamily: "ぼくたちのゴシック",
		importUrl: "https://mkkey.net/static-assets/fonts/bokutatino.css",
	},
	tetubin: {
		name: "鉄瓶ゴシック",
		fontFamily: "鉄瓶ゴシック",
		importUrl: "https://mkkey.net/static-assets/fonts/tetubin.css",
	},
	seto: {
		name: "瀬戸フォント",
		fontFamily: "瀬戸フォント",
		importUrl: "https://mkkey.net/static-assets/fonts/seto.css",
	},
	sinecaption: {
		name: "しねきゃぷしょん",
		fontFamily: "しねきゃぷしょん",
		importUrl: "https://mkkey.net/static-assets/fonts/sinecaption.css",
	},
	huifontp109: {
		name: "ふい字",
		fontFamily: "HuiFontP109",
		importUrl: "https://mkkey.net/static-assets/fonts/huifontp1092.css",
	},
	"hachi-maru-pop": {
		name: "はちまるポップ",
		fontFamily: "Hachi Maru Pop",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Hachi+Maru+Pop&display=swap",
	},
	"mochiy-pop": {
		name: "モッチーポップ",
		fontFamily: "Mochiy Pop P One",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Mochiy+Pop+P+One&display=swap",
	},
	lightnovel: {
		name: "ラノベPOPフォント",
		fontFamily: "ラノベPOPフォント",
		importUrl: "https://mkkey.net/static-assets/fonts/lightnovel.css",
	},
	"potta-one": {
		name: "ポッタ One",
		fontFamily: "Potta One",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Potta+One&display=swap",
	},
	"klee-one": {
		name: "クレー One",
		fontFamily: "Klee One",
		importUrl: "https://fonts.googleapis.com/css2?family=Klee+One&display=swap",
	},
	"zen-kaku-gothic": {
		name: "ZEN角ゴシック",
		fontFamily: "Zen Kaku Gothic New",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New&display=swap",
	},
	"zen-maru-gothic": {
		name: "ZEN丸ゴシック",
		fontFamily: "Zen Maru Gothic",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic&display=swap",
	},
	"kaisei-decol": {
		name: "解星デコール",
		fontFamily: "Kaisei Decol",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Kaisei+Decol&display=swap",
	},
	"rocknroll-one": {
		name: "ロックンロールワン",
		fontFamily: "RocknRoll One",
		importUrl:
			"https://fonts.googleapis.com/css2?family=RocknRoll+One&display=swap",
	},
	stick: {
		name: "ステッキ",
		fontFamily: "Stick",
		importUrl: "https://fonts.googleapis.com/css2?family=Stick&display=swap",
	},
	"yusei-magic": {
		name: "ユセイマジック",
		fontFamily: "Yusei Magic",
		importUrl:
			"https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap",
	},
	"dot-gothic16": {
		name: "ドットゴシック16",
		fontFamily: "DotGothic16",
		importUrl:
			"https://fonts.googleapis.com/css2?family=DotGothic16&display=swap",
	},
	pixelmplus12: {
		name: "PixelMplus12",
		fontFamily: "PixelMplus12 Regular",
		importUrl: "https://mkkey.net/static-assets/fonts/pixelmplus12.css",
	},
	esenapaj: {
		name: "エセナパJ",
		fontFamily: "EsenapaJ",
		importUrl: "https://mkkey.net/static-assets/fonts/esenapaj.css",
	},
};

/**
 * 指定されたフォント名を、`<style id="custom-font">` を `document.head` に注入することで body 全体に適用する。
 *
 * @remarks
 * - `fontname` に `null` / 空文字を渡した場合は注入済みの `<style>` を取り除き、デフォルト設定に戻す。
 * - `fontList` に存在しないキーが渡された場合は、その文字列を Google Fonts のファミリー名とみなして
 *   `https://fonts.googleapis.com/css2?family=<name>` URL を自動生成する(フォールバック)。
 * - フォールバックスタックには、絵文字・変体仮名・第二水準漢字を含むようにシステムフォントを並べている。
 *   `NekoSpoon` 等のグリフ欠損(例: 證/鈿/鉞)はこのスタックでカバーされる想定。
 *
 * NOTE: 同じ `id` の `<style>` を再利用することで、フォント切り替え時に古い `@import` が
 *       重複して残らないようにしている。
 *
 * @param fontname - 適用するフォントのキー(または Google Fonts ファミリー名)。`null` の場合はリセット。
 *
 * @public
 */
export function applyFont(fontname: null | string) {
	let style = document.getElementById("custom-font");

	if (!fontname) {
		if (!style) return;
		return style.remove();
	}

	if (!style) {
		style = document.createElement("style");
		style.id = "custom-font";
		document.head.appendChild(style);
	}

	let font = fontList[fontname];
	if (!font && fontname)
		font = {
			fontFamily: fontname,
			importUrl: `https://fonts.googleapis.com/css2?family=${fontname.replaceAll(
				/\s+/,
				"+",
			)}&display=swap`,
		};

	style.innerHTML = `
		@import url('${font.importUrl}');
		body {
			font-family: '${font.fontFamily}', -apple-system, BlinkMacSystemFont, "BIZ UDGothic", "HanaMinHentaigana", "HanaMinA", "HanaMinB", "Hanazono Mincho", Roboto, "Hiragino Sans", "Noto Sans CJK JP", HelveticaNeue, Arial, sans-serif, "Apple Color Emoji", "Noto Sans Emoji";
		}
	`;
}
