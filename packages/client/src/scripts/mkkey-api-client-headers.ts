/**
 * @packageDocumentation
 *
 * 公式 Web クライアントが API へ送る `X-Mkkey-Client` ヘッダーを一元管理する。
 *
 * @remarks
 * - **目的**: ログや WAF で「ビルド由来のクライアント識別子」を付けたリクエストかを見分けやすくする（値の偽装は可能で、セキュリティ境界には使わない）。
 * - **制約**: ブラウザの `WebSocket` や `window.open` ナビゲーションにはカスタムヘッダーを付けられないため、HTTP の `fetch` / `XMLHttpRequest` のみが対象。
 * - `version` は [packages/client/src/config.ts](packages/client/src/config.ts) のビルド時埋め込みに依存する（`os.ts` に依存させず循環を避ける）。
 *
 * @public
 */
import { version } from "@/config";

/** クライアント識別用の HTTP ヘッダー名（ログ・WAF 向け）。 */
export const MKKEY_CLIENT_HEADER_NAME = "X-Mkkey-Client";
/** API 呼び出し元ページの HTTP ヘッダー名（ログ追跡向け）。 */
export const MKKEY_PAGE_HEADER_NAME = "X-Mkkey-Page";

/**
 * API 呼び出し元ページ（pathname）を取得する。
 *
 * @remarks
 * NOTE: SSR や非ブラウザ環境では `location` がないため空文字を返す。
 * @returns 現在の `location.pathname`。取得不可時は空文字。
 * @internal
 */
function getCurrentPagePathname(): string {
	if (typeof location === "undefined" || !location.pathname) return "";
	return location.pathname;
}

/**
 * `X-Mkkey-Client` のみを含むヘッダー辞書を返す。
 *
 * @returns `X-Mkkey-Client` = ビルド時 `version`
 * @public
 */
export function getMkkeyClientHeaders(): Record<string, string> {
	return {
		[MKKEY_CLIENT_HEADER_NAME]: version,
		[MKKEY_PAGE_HEADER_NAME]: getCurrentPagePathname(),
	};
}

/**
 * 既存のリクエストヘッダーに `X-Mkkey-Client` を必ず上書きマージする。
 *
 * @remarks
 * NOTE: 後勝ちで付与し、呼び出し側が誤って同名を消しても常にクライアント版が載るようにする。
 * @param base - `Authorization` 等、既に設定するヘッダー（省略時は空）
 * @returns `fetch` / `XMLHttpRequest` に渡す平文ヘッダー辞書
 * @public
 */
export function mergeMkkeyApiClientHeaders(
	base?: Record<string, string>,
): Record<string, string> {
	return { ...(base ?? {}), ...getMkkeyClientHeaders() };
}

/**
 * `XMLHttpRequest` に `X-Mkkey-Client` を付与する（`open` 後・`send` 前に呼ぶ）。
 *
 * @param xhr - 対象の XHR
 * @public
 */
export function applyMkkeyClientHeadersToXhr(xhr: XMLHttpRequest): void {
	xhr.setRequestHeader(MKKEY_CLIENT_HEADER_NAME, version);
	xhr.setRequestHeader(MKKEY_PAGE_HEADER_NAME, getCurrentPagePathname());
}
