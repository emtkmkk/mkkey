/**
 * @packageDocumentation
 *
 * 画像 URL を、アニメーションしない静止画の URL に変換する
 *
 * @remarks
 * 「アニメーション画像を再生しない」設定のときに使う。
 *
 * @internal
 */

import { url as instanceUrl } from "@/config";
import { isMediaProxyUrl } from "@/scripts/media-proxy-fallback";
import * as url from "@/scripts/url";

/**
 * 画像 URL を静止画の URL に変換する
 *
 * @remarks
 * - このサーバの `/emoji/`、`/proxy/` と外部メディアプロキシの URL は、`static=1` を付けるだけにする。
 * - それ以外は、このサーバの `/proxy/` を通す。
 *
 * NB: 外部プロキシの URL を `/proxy/` で包むと、失敗時の切り替え（{@link getMediaFallbackUrls}）が
 * プロキシの URL と認識できず、失敗したプロキシをサーバから呼び続けるだけになる。
 * `avatar=1` は `static=1` と同時に指定する意味がないので外す。
 *
 * @param baseUrl - 元の画像 URL（相対 URL でもよい）
 * @returns 静止画の URL
 * @internal
 */
export function getStaticImageUrl(baseUrl: string): string {
	const u = baseUrl.startsWith("http")
		? new URL(baseUrl)
		: new URL(baseUrl, instanceUrl);
	if (u.href.startsWith(`${instanceUrl}/emoji/`)) {
		// もう既にemojiっぽそうだったらsearchParams付けるだけ
		u.searchParams.set("static", "1");
		return u.href;
	}
	if (u.href.startsWith(`${instanceUrl}/proxy/`)) {
		// もう既にproxyっぽそうだったらsearchParams付けるだけ
		u.searchParams.set("static", "1");
		return u.href;
	}
	if (isMediaProxyUrl(u.href)) {
		u.searchParams.delete("avatar");
		u.searchParams.set("static", "1");
		return u.href;
	}
	const dummy = "static.webp"; // 拡張子がないとキャッシュしてくれないCDNがあるので
	return `${instanceUrl}/proxy/${dummy}?${url.query({
		url: u.href,
		static: "1",
	})}`;
}
