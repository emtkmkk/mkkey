/**
 * @packageDocumentation
 *
 * 外部メディアプロキシが失敗したときの切り替え
 *
 * @remarks
 * リモートの画像は、サーバ設定 `mediaProxy` の外部プロキシ経由で読み込む。
 * プロキシが失敗したときは、別のプロキシ → このサーバの `/proxy` の順に読み直す。
 * 添付画像は {@link getMediaFallbackUrls}、絵文字は {@link getEmojiFallbackUrls} で次の URL を作る。
 *
 * 失敗の見分け方はプロキシによって違う。
 * - HTTP エラーを返すもの: `<img>` の `error` イベントで分かる。
 * - エラー画像を「成功（200）」として返すもの: `load` は成功するので、
 *   画像の大きさと応答ヘッダーで見分ける（{@link isProxyErrorImage}）。
 *
 * NB: エラー画像の判定は、Misskey 系メディアプロキシの次の挙動に頼っている。
 * - エラー画像は 256×256
 * - エラー時は `cache-control: no-store`、成功時は `max-age=31536000, immutable`
 * プロキシ側の仕様が変わると判定できなくなる（その場合は切り替えないだけで、表示は今までどおり）。
 *
 * @see {@link ../../../backend/src/misc/media-proxy.ts}
 * @internal
 */

import { url as instanceUrl } from "@/config";
import { instance } from "@/instance";

/**
 * 外部プロキシが失敗時に返すエラー画像の一辺の長さ（px）
 *
 * @remarks
 * media-proxy.jiskey.dev で確認した値。
 *
 * @internal
 */
const PROXY_ERROR_IMAGE_SIZE = 256;

/**
 * 画像 URL が失敗したときに、次に試す URL の一覧を返す
 *
 * @remarks
 * - 外部プロキシの URL なら、残りのプロキシを設定順に並べ、最後にこのサーバの `/proxy` を足す。
 * - `thumbnail` や `static` などの指定は、外部プロキシにはそのまま引き継ぐ。
 *   このサーバの `/proxy` は `thumbnail` を扱えないので、`static` だけ引き継ぐ。
 * - 外部プロキシの URL でないもの（このサーバの画像、すでに `/proxy` のものなど）は空配列を返す。
 *
 * @param src - 読み込みに失敗した画像の URL
 * @returns 次に試す URL の一覧（先頭から順に試す）
 *
 * @example
 * ```ts
 * getMediaFallbackUrls("https://proxy-a.example?url=https%3A%2F%2Fr.example%2Fa.webp&thumbnail=1");
 * // => [
 * //   "https://proxy-b.example?url=https%3A%2F%2Fr.example%2Fa.webp&thumbnail=1",
 * //   "https://このサーバ/proxy/image.webp?url=https%3A%2F%2Fr.example%2Fa.webp",
 * // ]
 * ```
 * @internal
 */
export function getMediaFallbackUrls(src: string): string[] {
	const proxies = instance.mediaProxies ?? [];
	const index = proxies.findIndex(
		(proxy) => src.startsWith(`${proxy}?`) || src.startsWith(`${proxy}/`),
	);
	if (index < 0) return [];

	let params: URLSearchParams;
	try {
		params = new URL(src).searchParams;
	} catch {
		return [];
	}
	const original = params.get("url");
	if (!original) return [];

	// 残りの外部プロキシ（今のプロキシの次から順に）
	const others: string[] = [];
	for (let i = 1; i < proxies.length; i++) {
		others.push(`${proxies[(index + i) % proxies.length]}?${params.toString()}`);
	}

	// 最後の手段としてこのサーバの /proxy を使う
	// 拡張子がないとキャッシュしない CDN があるので、ダミーのファイル名を付ける
	const local = new URLSearchParams({ url: original });
	if (params.has("static")) local.set("static", "1");

	return [...others, `${instanceUrl}/proxy/image.webp?${local.toString()}`];
}

/**
 * 絵文字の URL が失敗したときに、次に試す URL の一覧を返す
 *
 * @remarks
 * 絵文字は `/emoji/名前@ホスト.webp` へ要求し、サーバが外部プロキシへ転送（301）する。
 * どのプロキシへ転送されたかはクライアントから分からないので、サーバに次の指定で頼み直す。
 * - `?proxy=数字`: 本来の転送先から数えて何個先の外部プロキシを使うか
 * - `?proxy=local`: このサーバの `/proxy` を使う
 *
 * 外部プロキシが設定されていないときや、`/emoji/` の URL でないときは空配列を返す。
 *
 * @param src - 絵文字の URL（`/emoji/...` の相対 URL でもよい）
 * @returns 次に試す URL の一覧（先頭から順に試す）
 *
 * @example
 * ```ts
 * // 外部プロキシが 2 つ設定されているとき
 * getEmojiFallbackUrls("/emoji/blobcat@misskey.io.webp");
 * // => ["/emoji/blobcat@misskey.io.webp?proxy=1", "/emoji/blobcat@misskey.io.webp?proxy=local"]
 * ```
 * @see {@link ../../../backend/src/server/web/index.ts}
 * @internal
 */
export function getEmojiFallbackUrls(src: string): string[] {
	const proxyCount = instance.mediaProxies?.length ?? 0;
	if (proxyCount === 0 || !isEmojiRouteUrl(src)) return [];

	const withProxy = (value: string) => {
		const u = new URL(src, instanceUrl);
		u.searchParams.set("proxy", value);
		// 相対 URL で渡されたら相対 URL で返す（既存の候補と表記を揃えるため）
		return src.startsWith("/") ? `${u.pathname}${u.search}` : u.href;
	};

	const urls: string[] = [];
	for (let i = 1; i < proxyCount; i++) urls.push(withProxy(String(i)));
	urls.push(withProxy("local"));
	return urls;
}

/**
 * このサーバの `/emoji/` の URL かどうか
 *
 * @param src - 調べる URL（相対 URL でもよい）
 * @returns `/emoji/` の URL なら `true`
 * @internal
 */
function isEmojiRouteUrl(src: string): boolean {
	try {
		const u = new URL(src, instanceUrl);
		return u.origin === instanceUrl && u.pathname.startsWith("/emoji/");
	} catch {
		return false;
	}
}

/**
 * 読み込んだ画像が、外部プロキシのエラー画像かどうかを判定する
 *
 * @remarks
 * 次の 2 段階で判定する。
 * 1. 画像が 256×256 でなければ、エラー画像ではない（通信しない）。
 * 2. 256×256 なら同じ URL を `fetch()` で取り直し、`cache-control` に `no-store` があればエラー画像とみなす。
 *
 * 本物の 256×256 画像は `immutable` 付きで返るので、エラー扱いにならない。
 * `x-proxy-error` ヘッダーの方が確実だが、CORS で公開されておらずブラウザから読めないため使っていない。
 * `cache-control` は CORS でも常に読めるヘッダー。
 *
 * NB: 取り直しの間にプロキシ側が成功に変わると、表示中のエラー画像を見逃す。起きるのはまれなので許容している。
 * 取り直しが失敗したとき（通信エラーなど）は、エラー画像と確定できないので `false` を返す。
 *
 * @param img - 読み込みが終わった画像要素
 * @returns エラー画像とみなせるなら `true`
 * @internal
 */
export async function isProxyErrorImage(img: HTMLImageElement): Promise<boolean> {
	if (
		img.naturalWidth !== PROXY_ERROR_IMAGE_SIZE ||
		img.naturalHeight !== PROXY_ERROR_IMAGE_SIZE
	) {
		return false;
	}
	// 外部プロキシを通る画像（外部プロキシの URL か、外部プロキシへ転送される絵文字）以外は確認しない
	const src = img.currentSrc || img.src;
	if (getMediaFallbackUrls(src).length === 0 && getEmojiFallbackUrls(src).length === 0) {
		return false;
	}

	try {
		// 絵文字はこのサーバから外部プロキシへ転送されるが、fetch は転送先の応答ヘッダーを返す
		const res = await fetch(src, { mode: "cors" });
		// 本文は使わないので読み捨てる
		void res.body?.cancel();
		return /no-store/i.test(res.headers.get("cache-control") ?? "");
	} catch {
		return false;
	}
}

/**
 * 画像要素に URL を順に読み込ませ、最初に成功したところで止める
 *
 * @remarks
 * 読み込み失敗（`error`）と、外部プロキシのエラー画像（{@link isProxyErrorImage}）の両方を失敗として扱う。
 * すべて失敗したときは、最後に試した URL を表示したままにする。
 *
 * @param img - 読み込ませる画像要素
 * @param urls - 試す URL の一覧（先頭から順に試す）
 * @returns どれかが成功したら `true`
 * @internal
 */
export async function loadImageWithFallback(
	img: HTMLImageElement,
	urls: string[],
): Promise<boolean> {
	for (const url of urls) {
		const loaded = await new Promise<boolean>((resolve) => {
			img.onload = () => resolve(true);
			img.onerror = () => resolve(false);
			img.src = url;
		});
		if (loaded && !(await isProxyErrorImage(img))) return true;
	}
	return false;
}
