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
 * - 成功時は `cache-control: max-age=31536000, immutable`
 * - エラー時は `immutable` が付かない（プロキシにより `no-store`、`max-age=300`、`max-age=14400` など）
 * プロキシ側の仕様が変わると判定できなくなる（本物の 256×256 画像を別の URL で読み直すことはあるが、表示は壊れない）。
 *
 * @see {@link ../../../backend/src/misc/media-proxy.ts}
 * @internal
 */

import { url as instanceUrl } from "@/config";
import { instance } from "@/instance";
import { LimitedCache } from "@/scripts/limited-cache";

//#region 確認通信の保持と実行制御

/** 確認通信の同時数。画像自体の読み込みとは独立して制限する。 @internal */
const MAX_ACTIVE_IMAGE_CHECKS = 3;
/** 長時間放置しても待機Promiseを無制限に保持しないための上限。 @internal */
const MAX_PENDING_IMAGE_CHECKS = 128;
/** 待機中を含む確認の期限。判定不能時は従来どおり画像を失敗扱いにしない。 @internal */
const IMAGE_CHECK_TIMEOUT_MS = 10_000;

/**
 * URL単位で共有する確認処理。
 * @remarks doneを先に立て、期限切れと通信完了が重なっても枠を二重解放しない。
 * @internal
 */
interface ProxyImageCheck {
	src: string;
	promise: Promise<boolean>;
	resolve: (isError: boolean) => void;
	controller: AbortController | null;
	timer: ReturnType<typeof setTimeout> | null;
	started: boolean;
	done: boolean;
	expiresAt: number;
}

/** 実行中と待機中の確認。同じURLへの要求はこのPromiseを共有する。 @internal */
const pendingImageChecks = new Map<string, ProxyImageCheck>();
/** まだ通信を始めていない確認。期限切れ時は即座に除去する。 @internal */
const queuedImageChecks: ProxyImageCheck[] = [];
/** 現在通信中の件数。finishImageCheckで一度だけ減らす。 @internal */
let activeImageChecks = 0;

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
 * エラー画像ではないと確認できた URL
 *
 * @remarks
 * 256×256 のアイコンは多く、同じ画面に何度も出るため、確認の取り直しを 1 回で済ませる。
 * 成功の応答は `immutable` なので、ページを開いている間に結果が変わることは考えなくてよい。
 * 最近利用した512件だけ保持し、長時間開いたタブでも増え続けない。
 *
 * @internal
 */
const verifiedImageUrls = new LimitedCache<string, true>(512);

/**
 * 確認を完了し、待機中の別URLへ実行枠を渡す。
 * @remarks 期限後の通信結果は無視する。別の同一URL要求の登録を消さない。
 * @param check - 完了させる要求
 * @param isError - エラー画像と確定できた場合だけtrue
 * @returns なし
 * @internal
 */
function finishImageCheck(check: ProxyImageCheck, isError: boolean): void {
	if (check.done) return;
	check.done = true;
	if (check.timer !== null) clearTimeout(check.timer);
	if (check.started) activeImageChecks--;
	const index = queuedImageChecks.indexOf(check);
	if (index !== -1) queuedImageChecks.splice(index, 1);
	if (pendingImageChecks.get(check.src) === check) pendingImageChecks.delete(check.src);
	check.resolve(isError);
	drainImageChecks();
}

/**
 * 応答ヘッダーで画像の成否を確認する。
 * @remarks 通信失敗は判定不能であり、画像自体の失敗として扱わない。
 * @param check - 実行枠を確保した要求
 * @returns 確認完了
 * @internal
 */
async function runImageCheck(check: ProxyImageCheck): Promise<void> {
	try {
		// GETの転送先ヘッダーを使う従来の判定を保つ。本文は保持しない。
		const res = await fetch(check.src, { mode: "cors", signal: check.controller!.signal });
		const cacheControl = res.headers.get("cache-control");
		await res.body?.cancel();
		if (check.done) return;
		if (Date.now() >= check.expiresAt) {
			finishImageCheck(check, false);
			return;
		}
		const isError = cacheControl !== null && !/immutable/i.test(cacheControl);
		if (cacheControl !== null && !isError) verifiedImageUrls.set(check.src, true);
		finishImageCheck(check, isError);
	} catch {
		finishImageCheck(check, false);
	}
}

/**
 * 待機中の確認通信を上限まで開始する。
 * @remarks 開始済み状態を同期的に設定し、同一イベントループで上限を超えない。
 * @returns なし
 * @internal
 */
function drainImageChecks(): void {
	while (activeImageChecks < MAX_ACTIVE_IMAGE_CHECKS && queuedImageChecks.length > 0) {
		const check = queuedImageChecks.shift()!;
		// 復帰後に古い待機要求をまとめて通信へ流さない。
		if (Date.now() >= check.expiresAt) {
			finishImageCheck(check, false);
			continue;
		}
		check.started = true;
		check.controller = new AbortController();
		activeImageChecks++;
		void runImageCheck(check);
	}
}

//#endregion

/**
 * 外部メディアプロキシの URL かどうか
 *
 * @param src - 調べる URL
 * @returns 設定されている外部プロキシのどれかを指していれば `true`
 * @internal
 */
export function isMediaProxyUrl(src: string): boolean {
	return (instance.mediaProxies ?? []).some(
		(proxy) => src.startsWith(`${proxy}?`) || src.startsWith(`${proxy}/`),
	);
}

/**
 * 画像 URL が失敗したときに、次に試す URL の一覧を返す
 *
 * @remarks
 * - 外部プロキシの URL なら、残りのプロキシを設定順に並べ、最後にこのサーバの `/proxy` を足す。
 * - `static` などの指定は、外部プロキシにはそのまま引き継ぐ。
 *   このサーバの `/proxy` には `static` だけ引き継ぐ（それ以外の指定は扱えない）。
 * - 外部プロキシの URL でないもの（このサーバの画像、すでに `/proxy` のものなど）は空配列を返す。
 *
 * @param src - 読み込みに失敗した画像の URL
 * @returns 次に試す URL の一覧（先頭から順に試す）
 *
 * @example
 * ```ts
 * getMediaFallbackUrls("https://proxy-a.example?url=https%3A%2F%2Fr.example%2Fa.webp&static=1");
 * // => [
 * //   "https://proxy-b.example?url=https%3A%2F%2Fr.example%2Fa.webp&static=1",
 * //   "https://このサーバ/proxy/image.webp?url=https%3A%2F%2Fr.example%2Fa.webp&static=1",
 * // ]
 * ```
 * @internal
 */
export function getMediaFallbackUrls(src: string): string[] {
	const proxies = instance.mediaProxies ?? [];
	// 今のプロキシが設定の何番目か（次のプロキシから順に試すため）
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
 * 2. 256×256 なら同じ URL を `fetch()` で取り直し、`cache-control` に `immutable` がなければエラー画像とみなす。
 *
 * 本物の 256×256 画像は `immutable` 付きで返るので、エラー扱いにならない。
 * NB: `no-store` の有無では判定できない。media-proxy.misskey.blue のエラー画像は `max-age=300`
 * （絵文字は `max-age=14400`）で返るため。
 * `cache-control` が読めないときは、判定材料がないのでエラー画像とみなさない。
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
	if (verifiedImageUrls.get(src)) return false;
	const pending = pendingImageChecks.get(src);
	if (pending) return pending.promise;
	// 過負荷時も画像を壊さず、判定不能としてそのまま表示する。
	if (pendingImageChecks.size >= MAX_PENDING_IMAGE_CHECKS) return false;
	let resolve!: (isError: boolean) => void;
	const promise = new Promise<boolean>((onResolve) => { resolve = onResolve; });
	const check: ProxyImageCheck = {
		src, promise, resolve, controller: null, timer: null, started: false, done: false,
		expiresAt: Date.now() + IMAGE_CHECK_TIMEOUT_MS,
	};
	check.timer = setTimeout(() => {
		check.controller?.abort();
		finishImageCheck(check, false);
	}, IMAGE_CHECK_TIMEOUT_MS);
	pendingImageChecks.set(src, check);
	queuedImageChecks.push(check);
	drainImageChecks();
	return promise;
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
 * @returns 読み込めた URL。すべて失敗したら `null`
 * @internal
 */
export async function loadImageWithFallback(
	img: HTMLImageElement,
	urls: string[],
): Promise<string | null> {
	for (const url of urls) {
		const loaded = await new Promise<boolean>((resolve) => {
			img.onload = () => resolve(true);
			img.onerror = () => resolve(false);
			img.src = url;
		});
		if (loaded && !(await isProxyErrorImage(img))) return url;
	}
	return null;
}
