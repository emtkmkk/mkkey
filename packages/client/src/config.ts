const address = new URL(location.href);
const siteName = (
	document.querySelector('meta[property="og:site_name"]') as HTMLMetaElement
)?.content;

export const host = address.host;
export const hostname = address.hostname;
export const url = address.origin;
export const apiUrl = `${url}/api`;
export const wsUrl = `${url
	.replace("http://", "ws://")
	.replace("https://", "wss://")}/streaming`;
export const lang = localStorage.getItem("lang") || "ja-JP";
export const langs = _LANGS_;
/** boot.js が翻訳を fetch してから設定する。未設定・空の場合は {} になる（初回/キャッシュ削除後や locale JSON が空のとき）。 */
export const locale = JSON.parse(localStorage.getItem("locale") || "{}");
export const version = _VERSION_;
export const instanceName = siteName === "Cluckey" ? host : siteName;
export const ui = localStorage.getItem("ui");
export const debug = localStorage.getItem("debug") === "true";
