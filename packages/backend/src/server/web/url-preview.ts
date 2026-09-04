/**
 * @packageDocumentation
 *
 * URL プレビュー（OGP 取得・サムネイル・説明文）を生成する Web ルート。
 *
 * @remarks
 * - **役割**: Web サーバの url-preview ルートで呼ばれる。Summaly や HTML パース・DeepL 翻訳（任意）でメタデータを取得し、センシティブ判定・サイズ制限・キャッシュを行う。
 *
 * @see {@link web/index} Web サーバ
 * @internal
 */
import type Koa from "koa";
import summaly from "summaly";
import cheerio from "cheerio";
import { fetchMeta } from "@/misc/fetch-meta.js";
import Logger from "@/services/logger.js";
import config from "@/config/index.js";
import { query } from "@/prelude/url.js";
import { composeYouTubeDescription } from "@/misc/compose-youtube-description.js";
import {
	isYouTubeOembedTargetUrl,
} from "@/misc/is-youtube-oembed-target-url.js";
import { normalizeUrlForPreviewFetch } from "@/misc/normalize-url-for-preview-fetch.js";
import {
	buildUrlPreviewCacheKey,
	buildUrlPreviewSpecialInflightKey,
	fetchShortUrlResolveCached,
	resolveNegativeCacheTtlSec,
	storeNegativeRedis,
	storePositiveCaches,
	storePositiveMemoryOnly,
	tryGetNegativeRedis,
	tryGetPositiveMemory,
	tryGetPositiveRedis,
	withUrlPreviewInflight,
	withUrlPreviewOutboundLimits,
	withUrlPreviewSpecialInflight,
} from "@/misc/url-preview-outbound.js";
import {
	getHtml,
	getJson,
	getResponse,
	isUrlPreviewAbortStatusError,
} from "@/misc/fetch.js";
import {
	extractRetryAfterRawFromError,
	extractRetryAfterSecFromError,
	extractStatusCodeFromError,
} from "@/misc/url-preview-negative-ttl.js";
import {
  translateWithDeepl,
  formatDeeplTranslationPrefix,
} from "@/services/translation/deepl.js";
import type { Meta } from "@/models/entities/meta.js";

/**
 * Summaly 本流、または Summaly 互換 JSON を返すプロキシ経由 `getJson` の結果として扱う形。
 *
 * @remarks
 * NOTE: 三項演算子で `getJson`（`unknown`）と `summaly` を併用すると型が潰れるため、結合後にこの型へ寄せる。
 * NOTE: `isSensitive` / `preferLargeThumbnail` はこのハンドラ内で付与する（Summaly の `Summary` 型には無い）。
 *
 * @internal
 */
type SummalyFunction = typeof summaly;

const runtimeSummaly = (
  (summaly as unknown as { default?: SummalyFunction }).default ??
  summaly
) as SummalyFunction;

type UrlPreviewSummalyPayload = Awaited<ReturnType<SummalyFunction>> & {
  isSensitive?: boolean;
  preferLargeThumbnail?: boolean;
};

type YouTubeOembedPayload = {
	title?: string;
	author_name?: string;
	author_url?: string;
	type?: string;
	height?: number;
	width?: number;
	thumbnail_url?: string;
	html?: string;
	provider_name?: string;
};

/**
 * Summaly 呼び出しを 1 箇所に集約する。
 *
 * @remarks
 * NOTE: 現在の実行環境では `summaly` は `{ default: function }` の形で読み込まれる。
 * NOTE: 直呼びすると `TypeError: summaly is not a function` になるため、必ず `default` を呼ぶ。
 *
 * @internal
 */
function callSummaly(url: string, lang: string): Promise<Awaited<ReturnType<SummalyFunction>>> {
  return runtimeSummaly(url, {
    followRedirects: false,
    lang,
  });
}

const JAPANESE_CHAR_REGEX = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf\uf900-\ufa6d\uff66-\uff9f]/u;

function containsJapanese(text: string): boolean {
  return JAPANESE_CHAR_REGEX.test(text);
}

async function translateDescriptionToJapaneseIfNeeded(
  description: string | null | undefined,
  meta: Meta,
): Promise<string | null | undefined> {
  if (description == null || description === "") {
    return description;
  }

  if (!meta.deeplAuthKey || containsJapanese(description)) {
    return description;
  }

  const translated = await translateWithDeepl(description, "JA", meta);

  if (!translated?.text) {
    return description;
  }

  const prefix = formatDeeplTranslationPrefix(translated.sourceLang);
  return `${prefix} ${translated.text}`;
}

/**
 * YouTube oEmbed API から埋め込み情報を取得する。
 *
 * @remarks
 * NOTE: レスポンス不足・HTTP エラー時は throw して呼び出し元で Summaly へフォールバックする。
 *
 * @internal
 */
async function fetchYouTubeOembed(
	oembedTargetUrl: string,
	lang: string,
): Promise<YouTubeOembedPayload> {
	const oembedUrl = `https://www.youtube.com/oembed?${query({
		url: oembedTargetUrl,
		format: "json",
	})}`;
	return (await getJson(
		oembedUrl,
		"application/json, */*",
		5000,
		{
			"accept-language": normalizeLang(lang),
			"User-Agent": config.userAgent2 ?? config.userAgent,
		},
	)) as YouTubeOembedPayload;
}

/**
 * oEmbed の iframe HTML から src URL を抽出する。
 *
 * @param html - oEmbed の `html` フィールド
 * @returns src URL。抽出できない場合は null
 *
 * @internal
 */
function extractIframeSrcFromOembedHtml(html: string | null | undefined): string | null {
	if (!html) return null;
	const matched = html.match(/\bsrc=["']([^"']+)["']/i);
	if (!matched?.[1]) return null;
	return matched[1];
}

/**
 * YouTube プレビュー用の player URL を決める。
 *
 * @param oembedHtml - oEmbed の iframe HTML
 * @param videoId - URL から抽出した動画 ID
 * @returns player URL。どちらも無ければ null
 *
 * @internal
 */
function resolveYouTubePlayerUrl(
	oembedHtml: string | null | undefined,
	videoId: string | null,
): string | null {
	const iframeSrc = extractIframeSrcFromOembedHtml(oembedHtml);
	if (iframeSrc) return iframeSrc;
	if (!videoId) return null;
	return `https://www.youtube-nocookie.com/embed/${videoId}?feature=oembed`;
}

const logger = new Logger("url-preview");
const AMAZON_SHORTENER_HOSTNAME_PATTERN = /^(?:www\.)?amzn\.asia$/i;

const SENSITIVE_PREVIEW_FETCH_TIMEOUT_MS = 5000;
const SENSITIVE_PREVIEW_FETCH_SIZE = 65536; // 64KB

/**
 * Response の body を最大 maxBytes バイトまで読み、文字列で返す。
 * node-fetch の size オプションは body 超過時に res.text() で例外になるため、
 * ストリームを先頭 maxBytes だけ読んで判定に使う。
 * @internal
 */
async function readBodyUpTo(
	res: {
		body?: NodeJS.ReadableStream | null;
		text?: () => Promise<string>;
	},
	maxBytes: number,
): Promise<string> {
	const body = res.body as NodeJS.ReadableStream | undefined | null;
	if (!body) {
		const text = await res.text?.();
		return text ? text.slice(0, maxBytes) : "";
	}
	const stream = body as AsyncIterable<Buffer | Uint8Array> & {
		resume?: () => void;
		destroy?: () => void;
	};
	const chunks: Buffer[] = [];
	let total = 0;
	try {
		for await (const chunk of stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			total += chunks[chunks.length - 1].length;
			if (total >= maxBytes) {
				stream.resume?.();
				break;
			}
		}
	} finally {
		stream.resume?.();
	}
	const buf = Buffer.concat(chunks);
	const truncated =
		buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf;
	return truncated.toString("utf-8");
}

/**
 * HTTPヘッダとHTMLからセンシティブコンテンツかどうかを判定する。
 * mixi:content-rating '1'、Rating ヘッダ adult/RTA、meta rating adult/RTA のいずれかで true。
 * @internal
 */
function isSensitiveFromHeadersAndHtml(
	headers: { get?(name: string): string | null },
	html: string | null,
): boolean {
	const ratingHeader = headers.get?.("rating")?.trim();
	if (ratingHeader) {
		const r = ratingHeader.toLowerCase();
		if (r === "adult") return true;
		if (r === "rta-5042-1996-1400-1577-rta") return true;
	}
	if (!html) return false;
	const $ = cheerio.load(html);
	const mixi = $('meta[property="mixi:content-rating"]').attr("content");
	if (mixi === "1") return true;
	const metaRating = $('meta[name="rating"]').attr("content")?.trim();
	if (metaRating === "adult") return true;
	if (metaRating?.toUpperCase() === "RTA-5042-1996-1400-1577-RTA") return true;
	return false;
}

/**
 * HTMLから「大きくサムネイルを表示してよさそう」かどうかを判定する。
 * twitter:card summary_large_image/player または robots に max-image-preview:large があれば true。
 * @internal
 */
function preferLargeThumbnailFromHtml(html: string | null): boolean {
	if (!html) return false;
	const $ = cheerio.load(html);
	const twitterCard =
		$('meta[name="twitter:card"]').attr("content")?.trim() ??
		$('meta[property="twitter:card"]').attr("content")?.trim();
	if (twitterCard === "summary_large_image" || twitterCard === "player") return true;
	const robots = $('meta[name="robots"]').attr("content") ?? "";
	if (/max-image-preview:\s*large/i.test(robots)) return true;
	return false;
}

function isXLikeHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	return [
		"x.com",
		"www.x.com",
		"mobile.x.com",
		"twitter.com",
		"www.twitter.com",
		"mobile.twitter.com",
	].includes(normalized);
}

/**
 * X(Twitter) のサムネイルURLがメディア由来かどうかを判定する。
 * アイコン・汎用画像と見なせるものは false を返す。
 */
function hasXMediaThumbnail(thumbnail: string | null | undefined): boolean {
	if (!thumbnail) return false;

	try {
		const thumbnailUrl = new URL(thumbnail);
		const host = thumbnailUrl.hostname.toLowerCase();
		const path = thumbnailUrl.pathname.toLowerCase();

		if (host === "pbs.twimg.com") {
			return (
				path.startsWith("/media/") ||
				path.startsWith("/ext_tw_video_thumb/") ||
				path.startsWith("/amplify_video_thumb/") ||
				path.startsWith("/tweet_video_thumb/")
			);
		}

		if (host.endsWith("twimg.com")) {
			return false;
		}

		if (
			isXLikeHostname(host) &&
			(path === "/favicon.ico" || path.startsWith("/icons/"))
		) {
			return false;
		}
	} catch {
		return false;
	}

	return false;
}

/**
 * HTML から og:image / twitter:image を用いてサムネイルを補完する。
 * すでに summary.thumbnail が存在する場合は何もしない。
 */
function ensureThumbnailFromHtml(
	summary: { thumbnail?: string | null },
	html: string | null,
): void {
	if (summary.thumbnail) return;
	if (!html) return;
	const $ = cheerio.load(html);
	const ogImage =
		$('meta[property="og:image"]').attr("content")?.trim() ??
		$('meta[name="og:image"]').attr("content")?.trim();
	const twitterImage =
		$('meta[name="twitter:image"]').attr("content")?.trim() ??
		$('meta[property="twitter:image"]').attr("content")?.trim();
	const candidate = twitterImage || ogImage;
	if (
		candidate &&
		(candidate.startsWith("http://") || candidate.startsWith("https://"))
	) {
		// NOTE: ここでは wrap は呼ばず、生の URL を設定し、後段で wrap される前提とする
		summary.thumbnail = candidate;
	}
}

type UrlPreviewFailureStage =
	| "short-url-head"
	| "short-url-get"
	| "amazon-short-head"
	| "amazon-short-get"
	| "steam"
	| "steam-package"
	| "steam-bundle"
	| "amazon"
	| "summaly";

type UrlPreviewFailureDiagnostic = {
	status: number | null;
	message: string;
	retryAfterRaw: string | null;
	retryAfterSec: number | null;
	negativeCacheTtlSec: number | null;
	stage: UrlPreviewFailureStage;
	failedUrlHost: string | null;
	requestId: string;
	timestamp: string;
	code: "URL_PREVIEW_RATE_LIMIT" | "URL_PREVIEW_FORBIDDEN" | "URL_PREVIEW_FETCH_FAILED";
};

function buildRequestId(): string {
	return `url-preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeHostFromUrl(rawUrl: string): string | null {
	try {
		return new URL(rawUrl).hostname || null;
	} catch {
		return null;
	}
}

function buildFailureDiagnostic(
	err: unknown,
	stage: UrlPreviewFailureStage,
	requestId: string,
	failedUrl: string,
): UrlPreviewFailureDiagnostic {
	const status = extractStatusCodeFromError(err);
	const retryAfterRaw = extractRetryAfterRawFromError(err);
	const retryAfterSec = extractRetryAfterSecFromError(err);
	const negativeCacheTtlSec = resolveNegativeCacheTtlSec(err);
	const baseMessage =
		err instanceof Error && typeof err.message === "string"
			? err.message
			: "failed to fetch url preview";
	const message = baseMessage.length > 200 ? `${baseMessage.slice(0, 200)}...` : baseMessage;
	const code =
		status === 429
			? "URL_PREVIEW_RATE_LIMIT"
			: status === 403
				? "URL_PREVIEW_FORBIDDEN"
				: "URL_PREVIEW_FETCH_FAILED";

	return {
		status,
		message,
		retryAfterRaw,
		retryAfterSec,
		negativeCacheTtlSec,
		stage,
		failedUrlHost: safeHostFromUrl(failedUrl),
		requestId,
		timestamp: new Date().toISOString(),
		code,
	};
}

async function replyWithPreviewFailure(
	ctx: Koa.Context,
	cacheKeyHash: string,
	err: unknown,
	stage: UrlPreviewFailureStage,
	requestId: string,
	failedUrl: string,
): Promise<void> {
	await storeNegativeRedis(cacheKeyHash, err);
	const diagnostic = buildFailureDiagnostic(err, stage, requestId, failedUrl);
	ctx.status = 200;
	ctx.set("Cache-Control", "max-age=86400, immutable");
	ctx.body = {
		error: diagnostic,
	};
}

export const urlPreviewHandler = async (ctx: Koa.Context) => {
  const url = ctx.query.url;
  if (typeof url !== "string") {
    ctx.status = 400;
    return;
  }

  const lang = ctx.query.lang;
  if (Array.isArray(lang)) {
    ctx.status = 400;
    return;
  }

  const meta = await fetchMeta();
  const requestId = buildRequestId();
  const langKey = lang ?? "en-US";
  const baseSummaryFetchUrl = normalizeUrlForPreviewFetch(url);
  const basePreviewCacheHash = buildUrlPreviewCacheKey(
    baseSummaryFetchUrl,
    langKey,
    meta.summalyProxy ?? null,
  );

  logger.debug(
    meta.summalyProxy
      ? `(Proxy) Getting preview of ${url}@${lang} ...`
      : `Getting preview of ${url}@${lang} ...`
  );

  let redirectedUrl: string | null = null;
  try {
    redirectedUrl = await fetchShortUrlResolveCached(url, () =>
		resolveShortUrlIfNeeded(url),
	);
  } catch (err) {
    if (isUrlPreviewAbortStatusError(err)) {
      logger.warn(`Stop url-preview request by short URL abort status: ${err}`);
      await replyWithPreviewFailure(
        ctx,
        basePreviewCacheHash,
        err,
        "short-url-head",
        requestId,
        url,
      );
      return;
    }
    logger.warn(`Short URL resolution failed unexpectedly for ${url}: ${err}`);
  }
  // NOTE: Amazon 専用短縮 URL 解決などで解決後 URL が判明したら上書きするため、let で宣言する。
  let effectiveUrl = redirectedUrl ?? url;
  const isXPreviewUrl = (() => {
		try {
			return isXLikeHostname(new URL(effectiveUrl).hostname);
		} catch {
			return false;
		}
	})();

  // SteamのApp IDを取得
  const steamAppId = isSteamUrl(effectiveUrl);
  const steamPackageId = isSteamPackageUrl(effectiveUrl);
	const steamBundleId = isSteamBundleUrl(effectiveUrl);
  const VRCWorldId = isVRCUrl(effectiveUrl);
  let amazonFetchUrl = effectiveUrl;
  let resolvedAmazonProduct = isAmazonProductUrl(effectiveUrl);

  if (!resolvedAmazonProduct) {
    try {
      const resolvedAmazonUrl = await withUrlPreviewSpecialInflight(
        buildUrlPreviewSpecialInflightKey(["amazon-short-resolve", effectiveUrl]),
        () => resolveAmazonShortUrl(effectiveUrl),
      );
      if (resolvedAmazonUrl) {
        amazonFetchUrl = resolvedAmazonUrl;
        resolvedAmazonProduct = isAmazonProductUrl(amazonFetchUrl);
        // NOTE: Amazon 専用カードが失敗して Summaly フォールバックに回ったときに、
        //       短縮 URL のまま Summaly へ流すと Amazon 本体のリダイレクトを通った先での
        //       Content-Type / anti-bot 応答により `CancelError: Promise was canceled` を
        //       引き起こしやすい。解決済み URL を以降の処理（Summaly 呼び出し含む）でも使えるように反映する。
        effectiveUrl = resolvedAmazonUrl;
      }
    } catch (err) {
      if (isUrlPreviewAbortStatusError(err)) {
        logger.warn(`Stop url-preview request by amazon short URL abort status: ${err}`);
        await replyWithPreviewFailure(
          ctx,
          basePreviewCacheHash,
          err,
          "amazon-short-head",
          requestId,
          effectiveUrl,
        );
        return;
      }
      logger.warn(`Amazon short URL resolution failed unexpectedly for ${effectiveUrl}: ${err}`);
    }
  }

  // 以降は再代入しないため const に確定させる（コールバック内で null 絞り込みが効くようにするため）
  const amazonProduct = resolvedAmazonProduct;

  // Summaly が扱いやすい URL（例: music.youtube.com → www.youtube.com、ハッシュ除去）
  // NOTE: Amazon 短縮 URL の解決後 URL を拾うため、Amazon 専用解決ブロックの後で確定させる。
  const summaryFetchUrl = normalizeUrlForPreviewFetch(effectiveUrl);

  if (steamAppId) {
    // Steamの場合の処理
    try {
      const steamSpecialKey = buildUrlPreviewSpecialInflightKey([
        "steam",
        "app",
        String(steamAppId),
        lang ?? "ja",
        meta.summalyProxy ?? "",
        url,
        effectiveUrl,
      ]);
      const summary = await withUrlPreviewSpecialInflight(steamSpecialKey, async () => {
        const steamApiUrl = `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=jp&l=${
          lang ?? "ja"
        }`;

        const data = (await getJson(
          steamApiUrl,
          "application/json, */*",
          5000,
          {
            cookie: "steamCountry=JP",
            "accept-language": "ja-jp",
          },
        )) as Record<string, { success?: boolean; data?: any }>;

        const appData = data[steamAppId]?.data;

        if (!appData || !data[steamAppId]?.success) {
          throw new Error("Failed to get Steam app data");
        }

        const _summary = (meta.summalyProxy
          ? await getJson(
              `${meta.summalyProxy}?${query({
                url: url,
                lang: lang ?? "en-US",
              })}`,
              "application/json, */*",
              5000,
              {
                cookie: "steamCountry=JP",
              },
            )
          : await callSummaly(
              url,
              lang ?? "en-US",
            )) as UrlPreviewSummalyPayload;

        const summary = {
          url: url,
          title: appData.name,
          description: appData.short_description,
          thumbnail: "",
          icon: "https://store.steampowered.com/favicon.ico",
          sitename: "Steam",
          player: null as any,
          isSensitive: false,
          preferLargeThumbnail: false,
          steam: {
            ageLimit:
              appData.required_age && appData.required_age !== "0"
                ? appData.required_age
                : null,
            developer: appData.developers ? appData.developers.join(", ") : "",
            onSale: appData.price_overview
              ? appData.price_overview.discount_percent > 0
              : false,
            discountPercent: appData.price_overview
              ? appData.price_overview.discount_percent
              : 0,
            originalPrice: appData.price_overview
              ? appData.price_overview.initial_formatted
              : null,
            currentPrice: appData.price_overview
              ? appData.price_overview.final_formatted
              : null,
            isFree: appData.is_free,
            genres: appData.genres
              ? appData.genres.map((genre: { description: string }) => genre.description).join(", ")
              : "",
            releaseDate: {
              comingSoon: appData.release_date ? appData.release_date.coming_soon : false,
              date: appData.release_date ? appData.release_date.date : "",
            },
          },
        };

        summary.description = await translateDescriptionToJapaneseIfNeeded(
          summary.description,
          meta,
        );

        summary.icon = wrap(_summary.icon) ?? "";
        summary.thumbnail = wrap(_summary.thumbnail) ?? "";
        summary.isSensitive =
          appData.required_age != null &&
          parseInt(String(appData.required_age), 10) >= 17;
        summary.preferLargeThumbnail = !!summary.thumbnail;

        return summary;
      });

      ctx.set("Cache-Control", "max-age=604800, immutable");
      ctx.body = summary;
      return;
    } catch (err) {
      logger.warn(`Failed to get Steam data for ${url}: ${err}`);
      await replyWithPreviewFailure(
        ctx,
        basePreviewCacheHash,
        err,
        "steam",
        requestId,
        effectiveUrl,
      );
      return;
    }
  }


  if (steamPackageId) {
    // SteamPackageの場合の処理
    try {
      const steamPackageSpecialKey = buildUrlPreviewSpecialInflightKey([
        "steam",
        "package",
        String(steamPackageId),
        lang ?? "ja",
        meta.summalyProxy ?? "",
        url,
        effectiveUrl,
      ]);
      const summary = await withUrlPreviewSpecialInflight(steamPackageSpecialKey, async () => {
        const steamApiUrl = `https://store.steampowered.com/api/packagedetails?packageids=${steamPackageId}&cc=jp&l=${
          lang ?? "ja"
        }`;

        const data = (await getJson(
          steamApiUrl,
          "application/json, */*",
          5000,
          {
            cookie: "steamCountry=JP",
            "accept-language": "ja-jp",
          },
        )) as Record<string, { success?: boolean; data?: any }>;

        const subData = data[steamPackageId]?.data;

        if (!subData || !data[steamPackageId]?.success) {
          throw new Error("Failed to get Steam app data");
        }

        const _summary = (meta.summalyProxy
          ? await getJson(
              `${meta.summalyProxy}?${query({
                url: url,
                lang: lang ?? "en-US",
              })}`,
              "application/json, */*",
              5000,
              {
                cookie: "steamCountry=JP",
              },
            )
          : await callSummaly(
              url,
              lang ?? "en-US",
            )) as UrlPreviewSummalyPayload;

        const summary = {
          url: url,
          title: subData.name,
          description: subData.page_content?.split("\r\n")?.[0]?.slice(0, 160),
          thumbnail: "",
          icon: "https://store.steampowered.com/favicon.ico",
          sitename: "Steam",
          player: null as any,
          isSensitive: false,
          preferLargeThumbnail: false,
          steam: {
            ageLimit:
              subData.required_age && subData.required_age !== "0"
                ? subData.required_age
                : null,
            developer: subData.developers ? subData.developers.join(", ") : "",
            onSale: subData.price
              ? subData.price.discount_percent > 0
              : false,
            discountPercent: subData.price
              ? subData.price.discount_percent
              : 0,
            originalPrice: subData.price
              ? subData.price.initial_formatted ?? `\\ ${(subData.price.initial / 100).toLocaleString("ja-JP")}`
              : null,
            currentPrice: subData.price
              ? subData.price.final_formatted ?? `\\ ${(subData.price.final / 100).toLocaleString("ja-JP")}`
              : null,
            isFree: subData.is_free,
            genres: subData.genres
              ? subData.genres.map((genre: { description: string }) => genre.description).join(", ")
              : "",
            releaseDate: {
              comingSoon: subData.release_date ? subData.release_date.coming_soon : false,
              date: subData.release_date ? subData.release_date.date : "",
            },
          },
        };
        summary.description = await translateDescriptionToJapaneseIfNeeded(
          summary.description,
          meta,
        );

        summary.icon = wrap(_summary.icon) ?? "";
        summary.thumbnail = wrap(_summary.thumbnail) ?? "";
        summary.isSensitive =
          subData.required_age != null &&
          parseInt(String(subData.required_age), 10) >= 17;
        summary.preferLargeThumbnail = !!summary.thumbnail;

        return summary;
      });

      ctx.set("Cache-Control", "max-age=604800, immutable");
      ctx.body = summary;
      return;
    } catch (err) {
      logger.warn(`Failed to get Steam data for ${url}: ${err}`);
      await replyWithPreviewFailure(
        ctx,
        basePreviewCacheHash,
        err,
        "steam-package",
        requestId,
        effectiveUrl,
      );
      return;
    }
  }

  if (steamBundleId) {
    // SteamBundleの場合の処理
    try {
      const steamBundleSpecialKey = buildUrlPreviewSpecialInflightKey([
        "steam",
        "bundle",
        String(steamBundleId),
        lang ?? "ja",
        meta.summalyProxy ?? "",
        url,
        effectiveUrl,
      ]);
      const summary = await withUrlPreviewSpecialInflight(steamBundleSpecialKey, async () => {
        const steamApiUrl = `https://store.steampowered.com/actions/ajaxresolvebundles?bundleids=${steamBundleId}&cc=jp&l=${
          lang ?? "ja"
        }`;

        const data = (await getJson(
          steamApiUrl,
          "application/json, */*",
          5000,
          {
            cookie: "steamCountry=JP",
            "accept-language": "ja-jp",
          },
        )) as unknown[];

        const bundleData =
          data && Array.isArray(data) && data.length > 0 ? (data[0] as any) : undefined;

        if (!bundleData) {
          throw new Error("Failed to get Steam app data");
        }

        const _summary = (meta.summalyProxy
          ? await getJson(
              `${meta.summalyProxy}?${query({
                url: url,
                lang: lang ?? "en-US",
              })}`,
              "application/json, */*",
              5000,
              {
                cookie: "steamCountry=JP",
              },
            )
          : await callSummaly(
              url,
              lang ?? "en-US",
            )) as UrlPreviewSummalyPayload;

        const summary = {
          url: url,
          title: bundleData.name,
          description: bundleData.appids?.length
            ? `バンドル - ${bundleData.appids?.length} 個のコンテンツ`
            : "",
          thumbnail: "",
          icon: "https://store.steampowered.com/favicon.ico",
          sitename: "Steam",
          player: null as any,
          isSensitive: false,
          preferLargeThumbnail: false,
          steam: {
            ageLimit: null,
            developer: "",
            onSale: !!bundleData.discount_percent,
            discountPercent: bundleData.discount_percent,
            originalPrice: bundleData.formatted_orig_price,
            currentPrice: bundleData.formatted_final_price,
            isFree: false,
            genres: "",
            releaseDate: {
              comingSoon: bundleData.coming_soon,
              date: "",
            },
          },
        };

        summary.icon = wrap(_summary.icon) ?? "";
        summary.thumbnail = wrap(_summary.thumbnail) ?? "";
        summary.isSensitive = false;
        summary.preferLargeThumbnail = !!summary.thumbnail;

        return summary;
      });

      ctx.set("Cache-Control", "max-age=604800, immutable");
      ctx.body = summary;
      return;
    } catch (err) {
      logger.warn(`Failed to get Steam data for ${url}: ${err}`);
      await replyWithPreviewFailure(
        ctx,
        basePreviewCacheHash,
        err,
        "steam-bundle",
        requestId,
        effectiveUrl,
      );
      return;
    }
  }

  if (amazonProduct) {
    try {
      const localeInfo = getAmazonLocaleInfo(amazonProduct.hostname);
      const normalizedLang = normalizeLang(lang ?? localeInfo.locale);
      const amazonProductSpecialKey = buildUrlPreviewSpecialInflightKey([
        "amazon",
        "product",
        amazonProduct.hostname,
        amazonProduct.asin ?? "",
        amazonFetchUrl,
        normalizedLang ?? "",
        effectiveUrl,
      ]);
      const summary = await withUrlPreviewSpecialInflight(amazonProductSpecialKey, async () => {
        const res = await getResponse({
          url: amazonFetchUrl,
          method: "GET",
          headers: {
            Accept: "text/html, */*",
            // NOTE: Amazon は Bot ライクな UA（既定の Cluckey UA 等）を anti-bot で簡易ページに誘導するため、
            //       まず `userAgent2`（ブラウザ寄りに設定されている想定）を優先し、未設定時のみ既定 UA にフォールバックする。
            "User-Agent": config.userAgent2 ?? config.userAgent,
            "accept-language": normalizedLang ?? "en-US",
          },
          timeout: 10000,
        });
        const html = await res.text();

        const productData = extractAmazonProductData(html);
        const fallbackData = extractAmazonFallbackData(html);
        const iconHost = amazonProduct.hostname.replace(/^smile\./, "");
        const sitename = formatAmazonSitename(iconHost);

        if (!productData && !fallbackData) throw new Error("product data not found");
        // NOTE: ボット対策等で title だけが "Amazon.xx" になる簡易 HTML を掴んだ場合は、
        // Amazon 専用カードを組み立てず Summaly 本流にフォールバックする。
        if (
          isAmazonLikelyAntiBotEmptyPage({
            productData,
            fallbackData,
            sitename,
          })
        ) {
          throw new Error("amazon anti-bot empty page");
        }

        const rawTitle =
          productData?.name ??
          productData?.headline ??
          fallbackData?.title ??
          "Amazon";
        const normalizedTitle = stripAmazonChrome(cleanAmazonText(rawTitle) ?? "Amazon") ?? "Amazon";
        const description = sanitizeAmazonDescription(
          productData?.description ?? fallbackData?.description ?? null,
        );
        const normalizedDescription = stripAmazonChrome(description);
        const dedupedDescription =
          normalizeComparableText(normalizedTitle) === normalizeComparableText(normalizedDescription)
            ? null
            : normalizedDescription;
        const image = selectAmazonImage(productData) ?? fallbackData?.thumbnail ?? null;
        const offer = selectAmazonOffer(productData?.offers);
        const fallbackOffer =
          fallbackData?.priceText || fallbackData?.priceCurrency
            ? {
                price: fallbackData?.priceText ?? null,
                priceCurrency: fallbackData?.priceCurrency ?? null,
              }
            : null;
        const priceValue =
          extractPriceValue(offer) ??
          (fallbackOffer ? extractPriceValue(fallbackOffer) : null);
        const priceCurrency =
          extractPriceCurrency(offer) ??
          extractPriceCurrency(fallbackOffer) ??
          fallbackData?.priceCurrency ??
          localeInfo.currency;
        const priceDisplay =
          formatAmazonPrice(priceValue, priceCurrency, normalizedLang) ??
          offer?.price ??
          fallbackData?.priceText ??
          null;
        const availability =
          typeof offer?.availability === "string"
            ? humanizeAvailability(offer.availability, normalizedLang)
            : fallbackData?.availability ?? null;
        let rating = normalizeAmazonRating(productData?.aggregateRating);
        if (fallbackData) {
          rating = {
            value: rating.value ?? fallbackData.ratingValue ?? null,
            best:
              rating.best ??
              fallbackData.ratingBest ??
              (rating.value ?? fallbackData.ratingValue ? 5 : null),
            count: rating.count ?? fallbackData.ratingCount ?? null,
          };
        }
        const brand = extractBrand(productData?.brand) ?? fallbackData?.brand ?? null;
        const primeEligible =
          productData?.isPrimeEligible ?? fallbackData?.prime ?? false;
        const player = fallbackData?.playerUrl
          ? {
              url: fallbackData.playerUrl,
              width: fallbackData.playerWidth ?? null,
              height: fallbackData.playerHeight ?? null,
              allow:
                fallbackData.playerAllow ??
                (fallbackData.playerUrl ? ["fullscreen", "encrypted-media"] : []),
            }
          : null;

        const favicon = `https://${iconHost}/favicon.ico`;

        const wrappedThumbnail = wrap(image ?? undefined) ?? "";
        const isSensitive = isSensitiveFromHeadersAndHtml(res.headers, html);
        const preferLargeThumbnail = !!wrappedThumbnail;

        return {
          url,
          title: normalizedTitle,
          description: dedupedDescription,
          thumbnail: wrappedThumbnail,
          icon: wrap(favicon) ?? favicon,
          sitename,
          player: player ?? (null as any),
          amazon: {
            asin: amazonProduct.asin,
            price: {
              value: priceValue,
              currency: priceCurrency,
              display: priceDisplay,
            },
            availability,
            rating,
            brand,
            prime: primeEligible,
          },
          isSensitive,
          preferLargeThumbnail,
        };
      });

      ctx.set("Cache-Control", "max-age=604800, immutable");
      ctx.body = summary;
      return;
    } catch (err) {
      logger.info(`Failed to get Amazon data for ${url}: ${err}`);
      // フォールバックとして通常のサマリーを取得する
    }
  }

	//#region YouTube oEmbed 取得
	const youTubeTarget = isYouTubeOembedTargetUrl(effectiveUrl);
	if (youTubeTarget) {
		try {
			const youTubeSpecialKey = buildUrlPreviewSpecialInflightKey([
				"youtube",
				youTubeTarget.kind,
				youTubeTarget.oembedUrl,
				langKey,
				meta.summalyProxy ?? "",
			]);
			const summary = await withUrlPreviewSpecialInflight(youTubeSpecialKey, async () => {
				const oembed = await fetchYouTubeOembed(youTubeTarget.oembedUrl, langKey);
				const playerUrl = resolveYouTubePlayerUrl(
					oembed.html,
					youTubeTarget.videoId,
				);
				const description = composeYouTubeDescription(
					oembed.author_name,
					oembed.type,
					youTubeTarget.kind,
				);

				return {
					url,
					title: oembed.title ?? "",
					description,
					thumbnail: wrap(oembed.thumbnail_url) ?? "",
					icon: wrap("https://www.youtube.com/favicon.ico") ?? "",
					sitename: youTubeTarget.sitename,
					player: playerUrl
						? {
							url: playerUrl,
							width: typeof oembed.width === "number" ? oembed.width : 560,
							height: typeof oembed.height === "number" ? oembed.height : 315,
							allow: ["fullscreen", "encrypted-media", "picture-in-picture"],
						}
						: null,
					isSensitive: false,
					preferLargeThumbnail: true,
				};
			});
			ctx.set("Cache-Control", "max-age=604800, immutable");
			ctx.body = summary;
			return;
		} catch (err) {
			// NOTE: YouTube oEmbed が失敗した場合のみ Summaly 本流へフォールバックする。
			logger.warn(`Failed to get YouTube oEmbed for ${url}: ${err}`);
		}
	}
	//#endregion

  // 既存の処理（Summaly + センシティブ判定）。共有キャッシュ・インフライト・ホスト単位セマフォで外向きを抑える。
  const previewCacheHash = buildUrlPreviewCacheKey(
    summaryFetchUrl,
    langKey,
    meta.summalyProxy ?? null,
  );
  const urlPreviewCacheOn = config.urlPreview?.cacheEnabled !== false;

  if (urlPreviewCacheOn) {
    if (await tryGetNegativeRedis(previewCacheHash)) {
      ctx.status = 200;
      ctx.set("Cache-Control", "max-age=120, immutable");
      ctx.body = {
        error: {
          status: null,
          message: "negative cache hit",
          retryAfterRaw: null,
          retryAfterSec: null,
          negativeCacheTtlSec: null,
          stage: "summaly",
          failedUrlHost: safeHostFromUrl(summaryFetchUrl),
          requestId,
          timestamp: new Date().toISOString(),
          code: "URL_PREVIEW_FETCH_FAILED",
        },
      };
      return;
    }
    const memHit = tryGetPositiveMemory(previewCacheHash);
    if (memHit) {
      try {
        ctx.body = JSON.parse(memHit);
        ctx.set("Cache-Control", "max-age=604800, immutable");
        return;
      } catch {
        // JSON 破損時は再取得
      }
    }
    const redisHit = await tryGetPositiveRedis(previewCacheHash);
    if (redisHit) {
      try {
        ctx.body = JSON.parse(redisHit);
        ctx.set("Cache-Control", "max-age=604800, immutable");
        storePositiveMemoryOnly(previewCacheHash, redisHit);
        return;
      } catch {
        // 同上
      }
    }
  }

  try {
    // NOTE: インフライトを外側にし、同一キー待ちがセマフォ枠を占有しないようにする。
    const summary = await withUrlPreviewInflight(previewCacheHash, () =>
      withUrlPreviewOutboundLimits(summaryFetchUrl, async () => {
        const sm = (meta.summalyProxy
          ? await getJson(
              `${meta.summalyProxy}?${query({
                url: summaryFetchUrl,
                lang: langKey,
              })}`,
            )
          : await callSummaly(
              summaryFetchUrl,
              langKey,
            )) as UrlPreviewSummalyPayload;

        logger.debug(`Got preview of ${url}: ${sm.title}`);

        if (
          sm.url &&
          !(
            sm.url.startsWith("http://") ||
            sm.url.startsWith("https://")
          )
        ) {
          throw new Error("unsupported schema included");
        }

        if (
          sm.player?.url &&
          !(
            sm.player.url.startsWith("http://") ||
            sm.player.url.startsWith("https://")
          )
        ) {
          throw new Error("unsupported schema included");
        }

        if (VRCWorldId) {
          const VRCApiUrl = `https://api.vrchat.cloud/api/1/worlds/${VRCWorldId}`;

          const data = (await getJson(
            VRCApiUrl,
            "application/json, */*",
            5000,
          )) as {
            name?: string;
            authorName?: string;
            description?: string;
            imageUrl?: string;
            thumbnailImageUrl?: string;
          };

          if (data.name) {
            sm.title = [data.name, data.authorName, "VRChat"].filter(Boolean).join(" - ");
            sm.description = data.description || sm.description;
            sm.thumbnail = data.imageUrl || data.thumbnailImageUrl || sm.thumbnail;
          }
        }

        let googleMapsThumbnailAssigned = false;
        if (isGoogleMapsUrl(effectiveUrl)) {
          const googleMapsResult = await enrichGoogleMapsSummaryWithoutApiKey(
            effectiveUrl,
            sm,
            lang,
          );
          googleMapsThumbnailAssigned =
            googleMapsResult.thumbnailAssignedByGoogleMaps;
        }

        let summaryIsSensitive = false;
        let summaryPreferLargeThumbnail = false;
        try {
          const sensitiveRes = await getResponse({
            url: summaryFetchUrl,
            method: "GET",
            headers: {
              Accept: "text/html, */*",
              "User-Agent": config.userAgent,
            },
            timeout: SENSITIVE_PREVIEW_FETCH_TIMEOUT_MS,
          });
          const sensitiveHtml = await readBodyUpTo(
            sensitiveRes,
            SENSITIVE_PREVIEW_FETCH_SIZE,
          );

          ensureThumbnailFromHtml(sm, sensitiveHtml);

          summaryIsSensitive = isSensitiveFromHeadersAndHtml(
            sensitiveRes.headers,
            sensitiveHtml,
          );
          summaryPreferLargeThumbnail =
            preferLargeThumbnailFromHtml(sensitiveHtml) && !!sm.thumbnail;
        } catch (err) {
          logger.debug(`Sensitive/preferLarge check fetch failed for ${url}: ${err}`);
        }

        if (VRCWorldId && !!sm.thumbnail) {
          summaryPreferLargeThumbnail = true;
        }
        if (googleMapsThumbnailAssigned) {
          summaryPreferLargeThumbnail = true;
        }
        if (sm.player?.url) {
          summaryPreferLargeThumbnail = true;
        }

        if (isXPreviewUrl) {
          summaryPreferLargeThumbnail =
            !!sm.player?.url || hasXMediaThumbnail(sm.thumbnail);
        }

        sm.isSensitive = summaryIsSensitive;
        sm.preferLargeThumbnail = summaryPreferLargeThumbnail;

        sm.icon = wrap(sm.icon) ?? "";
        sm.thumbnail = wrap(sm.thumbnail) ?? "";
        if (typeof sm.sitename === "string") {
          const normalized = sm.sitename.replace(/\s+/g, " ").trim();
          sm.sitename = normalized.length > 0 ? normalized : "";
        }

        return sm;
      }),
    );

    ctx.set("Cache-Control", "max-age=604800, immutable");
    ctx.body = summary;
    if (urlPreviewCacheOn) {
      await storePositiveCaches(previewCacheHash, JSON.stringify(summary));
    }
  } catch (err) {
    logger.warn(`Failed to get preview of ${url}: ${err}`);
    await replyWithPreviewFailure(
      ctx,
      previewCacheHash,
      err,
      "summaly",
      requestId,
      summaryFetchUrl,
    );
  }
};

function normalizeLang(lang?: string | null): string {
  if (!lang) return "en-US";
  return lang.replace("ja-KS", "ja-JP").replace("ja-KK", "ja-JP");
}

function isGenericGoogleMapsTitle(title: unknown): boolean {
  if (typeof title !== "string") return false;
  const normalizedTitle = title.trim().toLowerCase();
  return normalizedTitle === "google maps" || normalizedTitle === "google マップ";
}

type GoogleMapsHtmlMeta = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  metaDescription: string | null;
  documentTitle: string | null;
};

type GoogleMapsJsonLdMeta = {
  name: string | null;
  address: string | null;
  image: string | null;
  category: string | null;
};

function filterGenericGoogleMapsTitle(value: string | null | undefined): string | null {
  if (!value) return null;
  return isGenericGoogleMapsTitle(value) ? null : value;
}

const GENERIC_GOOGLE_MAPS_DESCRIPTION_PATTERNS: RegExp[] = [
  /find local businesses,\s*view maps and get driving directions in google maps\.?/i,
  /ローカルのビジネス情報.*地図.*経路.*google\s*マップ/u,
];

function isGenericGoogleMapsDescription(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  if (!normalizedValue) return false;
  return GENERIC_GOOGLE_MAPS_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalizedValue));
}

/**
 * Google Maps 用のサマリー enrichment。
 * @returns サムネイルを Google Maps 由来（HTML/JSON-LD の og:image 等）で付与した場合に true
 */
async function enrichGoogleMapsSummaryWithoutApiKey(
  effectiveUrl: string,
  summary: {
    title?: string | null;
    description?: string | null;
    thumbnail?: string | null;
    icon?: string | null;
  },
  lang?: string | null,
): Promise<{ thumbnailAssignedByGoogleMaps: boolean }> {
  const adoptedSources = new Set<string>();
  try {
    let sourceB: GoogleMapsHtmlMeta | null = null;
    let sourceC: GoogleMapsJsonLdMeta | null = null;

    try {
      const html = await getHtml(
        effectiveUrl,
        "text/html, */*",
        5000,
        lang ? { "accept-language": normalizeLang(lang) } : undefined,
      );
      sourceB = extractGoogleMapsHtmlMeta(html);
      sourceC = extractGoogleMapsJsonLdMeta(html);
      if (
        sourceB.ogTitle ||
        sourceB.ogDescription ||
        sourceB.ogImage ||
        sourceB.twitterTitle ||
        sourceB.twitterDescription ||
        sourceB.twitterImage ||
        sourceB.metaDescription ||
        sourceB.documentTitle
      ) {
        adoptedSources.add("B");
      }
      if (sourceC.name || sourceC.address || sourceC.image || sourceC.category) {
        adoptedSources.add("C");
      }
    } catch (error) {
      logger.warn(`Google Maps HTML fetch failed: ${error}`);
    }

    const existingTitle = typeof summary.title === "string" ? summary.title : null;
    const existingTitleIsSpecific = !!existingTitle && !isGenericGoogleMapsTitle(existingTitle);

    const preferredTitle =
      sourceC?.name ??
      filterGenericGoogleMapsTitle(sourceB?.ogTitle) ??
      filterGenericGoogleMapsTitle(sourceB?.twitterTitle) ??
      filterGenericGoogleMapsTitle(sourceB?.documentTitle) ??
      existingTitle ??
      null;

    if (!existingTitleIsSpecific && preferredTitle) {
      summary.title = preferredTitle;
    }

    const ogDescriptionCandidate = isGenericGoogleMapsDescription(sourceB?.ogDescription)
      ? null
      : sourceB?.ogDescription;
    const twitterDescriptionCandidate = isGenericGoogleMapsDescription(sourceB?.twitterDescription)
      ? null
      : sourceB?.twitterDescription;
    const metaDescriptionCandidate = isGenericGoogleMapsDescription(sourceB?.metaDescription)
      ? null
      : sourceB?.metaDescription;

    const addressCandidate =
      sourceC?.address ??
      extractAddressLikeText(ogDescriptionCandidate) ??
      extractAddressLikeText(twitterDescriptionCandidate) ??
      extractAddressLikeText(metaDescriptionCandidate) ??
      null;
    const categoryCandidate = sourceC?.category ?? null;

    const builtDescription = buildGoogleMapsDescription({
      address: addressCandidate,
      category: categoryCandidate,
      fallback: typeof summary.description === "string" ? summary.description : null,
    });

    if (builtDescription) {
      summary.description = builtDescription;
    }

    const thumbnailCandidate = pickFirstValidHttpUrl([
      sourceC?.image,
      sourceB?.ogImage,
      sourceB?.twitterImage,
      summary.thumbnail,
      summary.icon,
    ]);
    const googleMapsThumbnailSources = [sourceC?.image, sourceB?.ogImage, sourceB?.twitterImage];
    const thumbnailAssignedByGoogleMaps =
      !!thumbnailCandidate &&
      googleMapsThumbnailSources.some(
        (u) => !!u && thumbnailCandidate === u,
      );
    if (thumbnailCandidate) {
      summary.thumbnail = thumbnailCandidate;
    }

    if (adoptedSources.size > 0) {
      logger.debug(`Google Maps enrichment sources: ${Array.from(adoptedSources).sort().join("/")}`);
    }
    return { thumbnailAssignedByGoogleMaps };
  } catch (error) {
    logger.warn(`Google Maps enrichment failed: ${error}`);
    return { thumbnailAssignedByGoogleMaps: false };
  }
}

function extractGoogleMapsHtmlMeta(html: string): GoogleMapsHtmlMeta {
  const $ = cheerio.load(html);
  return {
    ogTitle: sanitizeHtmlMetaValue($('meta[property="og:title"]').attr("content")),
    ogDescription: sanitizeHtmlMetaValue($('meta[property="og:description"]').attr("content")),
    ogImage: sanitizeHtmlMetaValue($('meta[property="og:image"]').attr("content")),
    twitterTitle: sanitizeHtmlMetaValue($('meta[name="twitter:title"]').attr("content")),
    twitterDescription: sanitizeHtmlMetaValue($('meta[name="twitter:description"]').attr("content")),
    twitterImage: sanitizeHtmlMetaValue($('meta[name="twitter:image"]').attr("content")),
    metaDescription: sanitizeHtmlMetaValue($('meta[name="description"]').attr("content")),
    documentTitle: sanitizeHtmlMetaValue($("title").first().text()),
  };
}

function extractGoogleMapsJsonLdMeta(html: string): GoogleMapsJsonLdMeta {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]')
    .map((_index, element) => $(element).text())
    .get();

  const jsonLdObjects: Record<string, unknown>[] = [];
  for (const scriptContent of scripts) {
    try {
      const parsed = JSON.parse(scriptContent) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && typeof entry === "object") {
            jsonLdObjects.push(entry as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        jsonLdObjects.push(parsed as Record<string, unknown>);
      }
    } catch {
      continue;
    }
  }

  const merged = jsonLdObjects.reduce<GoogleMapsJsonLdMeta>(
    (acc, obj) => {
      const name = sanitizeHtmlMetaValue(stringFromUnknown(obj.name));
      if (!acc.name && name) acc.name = name;

      const image = extractImageFromJsonLd(obj.image);
      if (!acc.image && image) acc.image = image;

      const category = sanitizeHtmlMetaValue(stringFromUnknown(obj.category));
      if (!acc.category && category) acc.category = category;

      const address = extractAddressFromJsonLd(obj.address);
      if (!acc.address && address) acc.address = address;

      return acc;
    },
    {
      name: null,
      address: null,
      image: null,
      category: null,
    },
  );

  return merged;
}

function extractAddressFromJsonLd(value: unknown): string | null {
  if (typeof value === "string") return sanitizeHtmlMetaValue(value);
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const parts = [
    stringFromUnknown(obj.streetAddress),
    stringFromUnknown(obj.addressLocality),
    stringFromUnknown(obj.addressRegion),
    stringFromUnknown(obj.postalCode),
    stringFromUnknown(obj.addressCountry),
  ].map(sanitizeHtmlMetaValue).filter((v): v is string => !!v);

  if (parts.length === 0) {
    return sanitizeHtmlMetaValue(stringFromUnknown(obj.name));
  }

  return parts.join(" ");
}

function extractImageFromJsonLd(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return pickFirstValidHttpUrl(value.map((item) => stringFromUnknown(item)));
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  return stringFromUnknown(obj.url) ?? stringFromUnknown(obj.contentUrl) ?? null;
}

function sanitizeHtmlMetaValue(value: string | null | undefined): string | null {
  const sanitized = value?.replace(/\s+/g, " ").trim();
  return sanitized ? sanitized : null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function extractAddressLikeText(value: string | null | undefined): string | null {
  const sanitized = sanitizeHtmlMetaValue(value);
  if (!sanitized) return null;
  const splitCandidates = sanitized
    .split(/[|｜•·]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = splitCandidates.find((part) => /\d|丁目|番地|県|市|区|町|村/.test(part));
  return candidate ?? null;
}

function buildGoogleMapsDescription(args: {
  address: string | null;
  category: string | null;
  fallback: string | null;
}): string | null {
  const segments: string[] = [];

  if (args.address) {
    segments.push(`住所: ${args.address}`);
  }
  if (args.category) {
    segments.push(`カテゴリ: ${args.category}`);
  }

  if (segments.length > 0) {
    return segments.join(" / ");
  }

  if (isGenericGoogleMapsDescription(args.fallback)) {
    return null;
  }

  return args.fallback;
}

function pickFirstValidHttpUrl(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isGoogleMapsHostname(hostname: string): boolean {
  const loweredHostname = hostname.toLowerCase();
  return (
    loweredHostname === "maps.google.com" ||
    loweredHostname.endsWith(".google.com") ||
    loweredHostname === "www.google.com" ||
    loweredHostname === "google.com"
  );
}

function isGoogleMapsUrl(url: string): boolean {
  try {
    return isGoogleMapsHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

// SteamのURLを判定し、App IDを取得する関数
function isSteamUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname === "store.steampowered.com" ||
      parsedUrl.hostname.endsWith(".steampowered.com")
    ) {
      const pathSegments = parsedUrl.pathname.split("/");
      const appIndex = pathSegments.indexOf("app");
      if (appIndex !== -1 && pathSegments.length > appIndex + 1) {
        return pathSegments[appIndex + 1];
      }
    }
    return null;
  } catch (error) {
    logger.warn("Invalid URL:", error);
    return null;
  }
}
function isSteamPackageUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname === "store.steampowered.com" ||
      parsedUrl.hostname.endsWith(".steampowered.com")
    ) {
      const pathSegments = parsedUrl.pathname.split("/");
      let appIndex = pathSegments.indexOf("sub");
      if (appIndex !== -1 && pathSegments.length > appIndex + 1) {
        return pathSegments[appIndex + 1];
      }
      appIndex = pathSegments.indexOf("package");
      if (appIndex !== -1 && pathSegments.length > appIndex + 1) {
        return pathSegments[appIndex + 1];
      }
    }
    return null;
  } catch (error) {
    logger.warn("Invalid URL:", error);
    return null;
  }
}

function isSteamBundleUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname === "store.steampowered.com" ||
      parsedUrl.hostname.endsWith(".steampowered.com")
    ) {
      const pathSegments = parsedUrl.pathname.split("/");
      const appIndex = pathSegments.indexOf("bundle");
      if (appIndex !== -1 && pathSegments.length > appIndex + 1) {
        return pathSegments[appIndex + 1];
      }
    }
    return null;
  } catch (error) {
    logger.warn("Invalid URL:", error);
    return null;
  }
}

function isAmazonProductUrl(url: string): { asin: string | null; hostname: string } | null {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    if (!/amazon\./i.test(hostname)) return null;

    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return { asin: null, hostname };

    const dpIndex = segments.findIndex((segment) => segment.toLowerCase() === "dp");
    if (dpIndex !== -1 && segments.length > dpIndex + 1) {
      return { asin: sanitizeAsin(segments[dpIndex + 1]), hostname };
    }

    const gpIndex = segments.findIndex((segment) => segment.toLowerCase() === "product");
    if (gpIndex > 0 && segments[gpIndex - 1].toLowerCase() === "gp") {
      const asin = segments[gpIndex + 1];
      if (asin) return { asin: sanitizeAsin(asin), hostname };
    }

    const awIndex = segments.findIndex((segment) => segment.toLowerCase() === "d");
    if (awIndex > 0 && segments[awIndex - 1].toLowerCase() === "aw") {
      const asin = segments[awIndex + 1];
      if (asin) return { asin: sanitizeAsin(asin), hostname };
    }

    return { asin: null, hostname };
  } catch (error) {
    logger.warn("Invalid URL:", error);
    return null;
  }
}

async function resolveAmazonShortUrl(originalUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch (error) {
    logger.warn("Invalid URL:", error);
    return null;
  }

  if (!isAmazonShortenerHostname(parsed.hostname)) {
    return null;
  }

  try {
    const headResponse = await getResponse({
      url: originalUrl,
      method: "HEAD",
      headers: {
        "User-Agent": config.userAgent,
        Accept: "*/*",
      },
      timeout: 5000,
    });

    const finalUrl = extractFinalUrl(originalUrl, headResponse);
    if (finalUrl) {
      return finalUrl;
    }
  } catch (error) {
    if (isUrlPreviewAbortStatusError(error)) {
      // NOTE: 429/403 は同一リクエスト内で再試行しても改善しにくいため、GET フォールバックを行わず打ち切る。
      throw error;
    }
    logger.debug(`HEAD request failed for ${originalUrl}: ${error}`);
  }

  try {
    const getResponseResult = await getResponse({
      url: originalUrl,
      method: "GET",
      headers: {
        "User-Agent": config.userAgent,
        Accept: "text/html, */*",
      },
      timeout: 10000,
    });

    const finalUrl = extractFinalUrl(originalUrl, getResponseResult);
    cancelResponseBody(getResponseResult);

    return finalUrl;
  } catch (error) {
    if (isUrlPreviewAbortStatusError(error)) {
      throw error;
    }
    logger.warn(`Failed to resolve Amazon short URL ${originalUrl}: ${error}`);
  }

  return null;
}

async function resolveShortUrlIfNeeded(originalUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch (error) {
    logger.warn("Invalid URL:", error);
    return null;
  }

  if (!isLikelyShortenerUrl(parsed)) {
    return null;
  }

  try {
    const headResponse = await getResponse({
      url: originalUrl,
      method: "HEAD",
      headers: {
        "User-Agent": config.userAgent,
        Accept: "*/*",
      },
      timeout: 5000,
    });

    const finalUrl = extractFinalUrl(originalUrl, headResponse);
    if (finalUrl && finalUrl !== originalUrl) {
      return finalUrl;
    }
  } catch (error) {
    if (isUrlPreviewAbortStatusError(error)) {
      // NOTE: 429/403 は同一リクエスト内で再試行しても改善しにくいため、GET フォールバックを行わず打ち切る。
      throw error;
    }
    logger.debug(`HEAD request failed for ${originalUrl}: ${error}`);
  }

  try {
    const getResponseResult = await getResponse({
      url: originalUrl,
      method: "GET",
      headers: {
        "User-Agent": config.userAgent,
        Accept: "text/html, */*",
      },
      timeout: 10000,
    });

    const finalUrl = extractFinalUrl(originalUrl, getResponseResult);
    cancelResponseBody(getResponseResult);

    if (finalUrl && finalUrl !== originalUrl) {
      return finalUrl;
    }
  } catch (error) {
    if (isUrlPreviewAbortStatusError(error)) {
      throw error;
    }
    logger.warn(`Failed to resolve short URL ${originalUrl}: ${error}`);
  }

  return null;
}

function isLikelyShortenerUrl(url: URL): boolean {
  if (isKnownShortenerHostname(url.hostname)) {
    return true;
  }

  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") {
    return false;
  }

  const segments = path.split("/").filter(Boolean);
  if (segments.length > 2) {
    return false;
  }

  const token = segments[segments.length - 1] ?? "";
  if (token.length < 4 || token.length > 40) {
    return false;
  }

  const loweredHost = url.hostname.toLowerCase();
  if (
    loweredHost.includes("amazon.") ||
    loweredHost.includes("google.") ||
    loweredHost.endsWith(".google.com") ||
    loweredHost === "google.com"
  ) {
    return false;
  }

  return /^[a-z0-9_-]+$/i.test(token);
}

function isKnownShortenerHostname(hostname: string): boolean {
  return [
    AMAZON_SHORTENER_HOSTNAME_PATTERN,
    /^maps\.app\.goo\.gl$/i,
    /^t\.co$/i,
    /^bit\.ly$/i,
    /^tinyurl\.com$/i,
    /^goo\.gl$/i,
    /^is\.gd$/i,
    /^ow\.ly$/i,
    /^buff\.ly$/i,
    /^ift\.tt$/i,
    /^j\.mp$/i,
    /^reut\.rs$/i,
    /^trib\.al$/i,
  ].some((pattern) => pattern.test(hostname));
}

function isAmazonShortenerHostname(hostname: string): boolean {
  return AMAZON_SHORTENER_HOSTNAME_PATTERN.test(hostname);
}

type FetchResponse = ReturnType<typeof getResponse> extends Promise<infer T>
  ? T
  : never;

function extractFinalUrl(originalUrl: string, response: FetchResponse): string | null {
  if (response.url) {
    return response.url;
  }

  const location = response.headers.get("location");
  if (!location) {
    return null;
  }

  try {
    return new URL(location, originalUrl).href;
  } catch (error) {
    logger.warn("Failed to parse redirect location:", error);
    return null;
  }
}

function cancelResponseBody(response: FetchResponse): void {
  const body: any = response.body;
  if (!body) return;

  if (typeof body.cancel === "function") {
    try {
      body.cancel();
      return;
    } catch (error) {
      logger.debug(`Failed to cancel response body: ${error}`);
    }
  }

  if (typeof body.destroy === "function") {
    try {
      body.destroy();
    } catch (error) {
      logger.debug(`Failed to destroy response body: ${error}`);
    }
  }
}

function sanitizeAsin(segment: string): string {
  return segment.replace(/[^A-Z0-9]/gi, "").slice(0, 10) || segment;
}

function extractAmazonProductData(html: string): any | null {
  const scripts = extractJsonLdScripts(html);

  for (const content of scripts) {
    if (!content) continue;

    const candidates = buildJsonCandidates(content);
    for (const candidate of candidates) {
      try {
        const json = JSON.parse(candidate);
        const product = findProductNode(json);
        if (product) return product;
      } catch (err) {
        continue;
      }
    }
  }

  return null;
}

type AmazonFallbackData = {
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  priceText: string | null;
  priceCurrency: string | null;
  availability: string | null;
  ratingValue: number | null;
  ratingBest: number | null;
  ratingCount: number | null;
  brand: string | null;
  prime: boolean;
  playerUrl: string | null;
  playerWidth: number | null;
  playerHeight: number | null;
  playerAllow: string[] | null;
};

/**
 * Amazon 商品ページの HTML から、JSON-LD 不足時のフォールバック情報を抽出する。
 *
 * @remarks
 * NOTE: Amazon のボット対策ページでは `<title>` しか取得できない場合がある。
 * その場合は呼び出し側で `isAmazonLikelyAntiBotEmptyPage` 判定を行い、Summaly 本流へフォールバックする。
 *
 * @param html - Amazon 商品ページとして取得した HTML 文字列
 * @returns 価格・評価・説明などを含むフォールバック情報。実質空の場合は null
 *
 * @internal
 */
function extractAmazonFallbackData(html: string): AmazonFallbackData | null {
  const $ = cheerio.load(html);

  const title = cleanAmazonText(
    $("#title").text() ||
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      $("title").first().text(),
  );

  // NOTE: meta[name=description]/og:description は SEO 文で、商品の概要と一致しない場合がある。
  // NOTE: 商品説明が存在しない商品では description を空にしたいので #productDescription のみ採用する。
  const description = cleanAmazonText($("#productDescription").text());

  const thumbnail = cleanAmazonAttr(
    $("#landingImage").attr("src") ||
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content"),
  );

  const priceText = cleanAmazonText(
    $("#priceblock_ourprice").text() ||
      $("#priceblock_dealprice").text() ||
      $("span.a-price .a-offscreen").first().text(),
  );

  const priceCurrency =
    cleanAmazonAttr(
      $('meta[property="og:price:currency"]').attr("content") ||
        $('meta[name="priceCurrency"]').attr("content"),
    ) ?? null;

  const availabilityRoot = $("#availability").clone();
  availabilityRoot.find("a, .a-declarative, .a-popover-trigger, script, style").remove();
  const availability = sanitizeAmazonAvailabilityText(
    cleanAmazonText(
      availabilityRoot.text() || $("span[data-availability]").attr("data-availability"),
    ),
  );

  const prime =
    $(".a-icon-prime").length > 0 ||
    $("#prime-availability-badge").length > 0 ||
    $("[data-asin-prime-info]").length > 0 ||
    $("i[data-component-type='s-prime']").length > 0;

  const ratingValue = parseAmazonRatingValue(
    $("#acrPopover").attr("title") ||
      $("span[data-hook='rating-out-of-text']").first().text(),
  );
  const ratingCount = parseAmazonInteger(
    $("#acrCustomerReviewText").text() ||
      $("span[data-hook='total-review-count']").text(),
  );
  const ratingBest = ratingValue != null ? 5 : null;

  const brand = normalizeAmazonBrand(
    $("#bylineInfo").text() ||
      $("a#bylineInfo").text() ||
      $("tr.po-brand td.po-break-word").text() ||
      $("div#bylineInfo").text(),
  );

  const playerUrl = cleanAmazonAttr(
    $('meta[property="twitter:player"]').attr("content") ||
      $('meta[name="twitter:player"]').attr("content"),
  );
  const playerWidth = parseAmazonInteger(
    $('meta[property="twitter:player:width"]').attr("content") ||
      $('meta[name="twitter:player:width"]').attr("content"),
  );
  const playerHeight = parseAmazonInteger(
    $('meta[property="twitter:player:height"]').attr("content") ||
      $('meta[name="twitter:player:height"]').attr("content"),
  );
  const playerAllow = playerUrl ? ["fullscreen", "encrypted-media"] : [];

  const hasMeaningfulData =
    Boolean(title || description || thumbnail || priceText || availability || brand || playerUrl) ||
    ratingValue != null ||
    ratingCount != null ||
    prime;

  if (!hasMeaningfulData) {
    return null;
  }

  return {
    title,
    description,
    thumbnail,
    priceText,
    priceCurrency,
    availability,
    ratingValue,
    ratingBest,
    ratingCount,
    brand,
    prime,
    playerUrl,
    playerWidth,
    playerHeight,
    playerAllow,
  };
}

/**
 * Amazon の簡易ページ（アンチボット等）を誤って商品ページとして扱わないための判定。
 *
 * @remarks
 * NOTE: `productData` が取れず、`fallbackData` が「サイト名 title のみ」で実質空なら true を返す。
 *
 * @param args - Amazon 解析の中間データ
 * @returns Summaly 本流にフォールバックすべき場合は true
 *
 * @internal
 */
function isAmazonLikelyAntiBotEmptyPage(args: {
  productData: any | null;
  fallbackData: AmazonFallbackData | null;
  sitename: string;
}): boolean {
  if (args.productData != null) return false;
  if (!args.fallbackData) return false;

  const normalizedTitle = cleanAmazonText(args.fallbackData.title);
  if (!normalizedTitle || normalizedTitle !== args.sitename) {
    return false;
  }

  const hasMeaningfulDetails =
    args.fallbackData.description != null ||
    args.fallbackData.thumbnail != null ||
    args.fallbackData.priceText != null ||
    args.fallbackData.priceCurrency != null ||
    args.fallbackData.availability != null ||
    args.fallbackData.ratingValue != null ||
    args.fallbackData.ratingCount != null ||
    args.fallbackData.brand != null ||
    args.fallbackData.playerUrl != null ||
    args.fallbackData.prime;

  return !hasMeaningfulDetails;
}

function extractJsonLdScripts(html: string): string[] {
  const scripts: string[] = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const content = match[1]?.trim();
    if (content) scripts.push(content);
  }
  return scripts;
}

function buildJsonCandidates(content: string): string[] {
  const trimmed = content
    .replace(/<!--.*?-->/gs, "")
    .replace(/\s*;\s*$/, "")
    .trim();
  const candidates = new Set<string>();
  if (!trimmed) return [];

  candidates.add(trimmed);

  if (!trimmed.startsWith("[")) {
    const arrayWrapped = `[${trimmed.replace(/}\s*{/g, "},{")}]`;
    candidates.add(arrayWrapped);
  }

  return Array.from(candidates.values());
}

function cleanAmazonText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

/**
 * Amazon 在庫テキストから、補助リンク由来のノイズを除去する。
 *
 * @remarks
 * NOTE: Amazon は在庫ラベルと「在庫状況について」リンク文言を同じ領域へ混在させることがあり、
 * そのまま `.text()` すると「在庫あり。について 残り1点 ...」のような不自然な文になる。
 * NOTE: 「在庫あり」と「残り◯点」が同居した場合は、具体性の高い後者を優先する。
 *
 * @param value - 在庫表示候補の生テキスト
 * @returns ノイズ除去後の在庫表示。空なら null
 *
 * @internal
 */
function sanitizeAmazonAvailabilityText(value: string | null): string | null {
  if (!value) return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  const withoutHelpText = collapsed
    .replace(/在庫状況について/g, "")
    .replace(/Learn more about availability/gi, "")
    .replace(/。?\s*について\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lowStockMatch = withoutHelpText.match(
    /(残り\s*\d+\s*点(?:\s*ご注文はお早めに)?)/,
  );
  if (lowStockMatch) {
    const lowStockText = cleanAmazonText(lowStockMatch[1]);
    if (lowStockText) return lowStockText;
  }

  const deduplicatedInStock = withoutHelpText.replace(
    /(在庫あり。?)(?:\s*\1)+/g,
    "$1",
  );
  const sanitized = deduplicatedInStock.replace(/\s+/g, " ").trim();
  return sanitized.length > 0 ? sanitized : null;
}

function cleanAmazonAttr(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Amazon の評価値テキストから、表示用レーティング値を抽出する。
 *
 * @remarks
 * NOTE: 「5つ星のうち4.2」のような日本語表現では、先頭数値（5）ではなく「うち」の後ろを採用する必要がある。
 * NOTE: 英語表現「4.2 out of 5 stars」にも対応し、最後に汎用抽出でフォールバックする。
 *
 * @param value - 評価値候補テキスト
 * @returns 0〜5 の評価値。抽出失敗または範囲外は null
 *
 * @internal
 */
function parseAmazonRatingValue(value: string | null | undefined): number | null {
  if (!value) return null;

  const japaneseMatch = value.match(/うち\s*([0-9]+[.,]?[0-9]*)/i);
  const englishMatch = value.match(/([0-9]+[.,]?[0-9]*)\s*out\s+of\s+[0-9]+[.,]?[0-9]*/i);
  const fallbackMatch = value.match(/([0-9]+[.,]?[0-9]*)/);
  const candidate = japaneseMatch?.[1] ?? englishMatch?.[1] ?? fallbackMatch?.[1];
  if (!candidate) return null;

  const normalized = candidate.replace(/,/g, ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed >= 0 && parsed <= 5 ? parsed : null;
}

function parseAmazonInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const matchedNumber = value.match(/\d[\d,]*/);
  if (!matchedNumber) return null;
  const normalized = matchedNumber[0].replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Amazon のブランド表記をノイズ除去して正規化する。
 *
 * @remarks
 * NOTE: Amazon の表示では `PHILIPS のストアを表示` のように半角空白を挟むことが多いが、
 *       HTML 構造によっては改行・空白が剥がれ `PHILIPSのストアを表示` のようにブランド名へ直結する場合がある。
 *       いずれのパターンでも末尾ノイズを落とせるよう、区切りの空白は必須にせず `\s*` にしている。
 * NOTE: `Visit the ... Store` 形式は `Visit the` を落とした時点で末尾が ` Store` になるため、
 *       末尾の Store 掃除は空白有無の両対応で残している。
 *
 * @param value - ブランド欄から抽出した生テキスト
 * @returns 整形後のブランド文字列。空や null の場合は null
 *
 * @internal
 */
function normalizeAmazonBrand(value: string | null | undefined): string | null {
  const text = cleanAmazonText(value);
  if (!text) return null;
  const normalized = text
    .replace(/^ブランド[:：]?\s*/i, "")
    .replace(/^出版社[:：]?\s*/i, "")
    .replace(/^メーカー[:：]?\s*/i, "")
    .replace(/^販売元[:：]?\s*/i, "")
    .replace(/^Brand[:：]?\s*/i, "")
    .replace(/^Visit the\s+/i, "")
    .replace(/\s*のストアを表示(?:する)?$/i, "")
    .replace(/\s*のストア$/i, "")
    .replace(/\s*のページを表示(?:する)?$/i, "")
    .replace(/\s*Store$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

const PRODUCT_LIKE_JSONLD_TYPES = new Set([
  "product",
  "book",
  "movie",
  "musicalbum",
  "videogame",
  "softwareapplication",
  "individualproduct",
  "productmodel",
]);

function findProductNode(node: any): any | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    const type = node["@type"];
    const types = Array.isArray(type) ? type : type ? [type] : [];
    if (
      types.some(
        (t) => typeof t === "string" && PRODUCT_LIKE_JSONLD_TYPES.has(t.toLowerCase()),
      )
    ) {
      return node;
    }

    if (node.mainEntity) {
      const found = findProductNode(node.mainEntity);
      if (found) return found;
    }

    if (node["@graph"]) {
      const found = findProductNode(node["@graph"]);
      if (found) return found;
    }

    if (node.itemListElement) {
      const found = findProductNode(node.itemListElement);
      if (found) return found;
    }
  }

  return null;
}

function selectAmazonImage(productData: any): string | null {
  const image = productData?.image;
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    for (const entry of image) {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && typeof entry.url === "string") {
        return entry.url;
      }
    }
  }
  if (typeof image === "object" && typeof image.url === "string") return image.url;
  return null;
}

function selectAmazonOffer(offers: any): any | null {
  if (!offers) return null;
  if (Array.isArray(offers)) {
    for (const offer of offers) {
      if (offer && typeof offer === "object") {
        return offer;
      }
    }
    return null;
  }
  return typeof offers === "object" ? offers : null;
}

function extractPriceValue(offer: any): number | null {
  if (!offer) return null;
  const candidates = [offer.price, offer.lowPrice, offer.priceSpecification?.price];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const numeric = Number(
      String(candidate)
        .replace(/[^0-9.,-]/g, "")
        .replace(/,(?=\d{3}(?:\D|$))/g, "")
        .replace(/,/g, "")
    );
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function extractPriceCurrency(offer: any): string | null {
  if (!offer) return null;
  return (
    offer.priceCurrency ||
    offer.priceSpecification?.priceCurrency ||
    offer.priceSpecification?.currency ||
    offer.currency
  ) ?? null;
}

function formatAmazonPrice(
  value: number | null,
  currency: string | null,
  lang: string
): string | null {
  if (value == null || !currency) return null;
  try {
    return new Intl.NumberFormat(lang, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (err) {
    return value.toString();
  }
}

function humanizeAvailability(value: string, lang: string): string {
  const key = value.split("/").pop()?.toLowerCase() ?? value.toLowerCase();
  const isJapanese = lang.startsWith("ja");
  switch (key) {
    case "instock":
      return isJapanese ? "在庫あり" : "In stock";
    case "outofstock":
      return isJapanese ? "在庫切れ" : "Out of stock";
    case "presale":
    case "preorder":
      return isJapanese ? "予約受付中" : "Preorder";
    case "preorderavailable":
      return isJapanese ? "予約可能" : "Preorder available";
    case "discontinued":
      return isJapanese ? "販売終了" : "Discontinued";
    case "limitedavailability":
      return isJapanese ? "在庫僅少" : "Limited availability";
    default:
      return value;
  }
}

function normalizeAmazonRating(rating: any): {
  value: number | null;
  best: number | null;
  count: number | null;
} {
  if (!rating || typeof rating !== "object") {
    return { value: null, best: null, count: null };
  }
  const value = rating.ratingValue ?? rating.rating ?? null;
  const best = rating.bestRating ?? rating.best ?? null;
  const count = rating.ratingCount ?? rating.reviewCount ?? null;

  const parsedValue = value != null ? Number(value) : null;
  const parsedBest = best != null ? Number(best) : null;
  const parsedCount = count != null ? Number(count) : null;

  return {
    value: parsedValue != null && Number.isFinite(parsedValue) ? parsedValue : null,
    best: parsedBest != null && Number.isFinite(parsedBest) ? parsedBest : null,
    count: parsedCount != null && Number.isFinite(parsedCount) ? parsedCount : null,
  };
}

function extractBrand(brand: any): string | null {
  if (!brand) return null;
  if (typeof brand === "string") return brand;
  if (typeof brand === "object") {
    if (typeof brand.name === "string") return brand.name;
    if (typeof brand.brand === "string") return brand.brand;
  }
  return null;
}

function sanitizeAmazonDescription(description: unknown): string | null {
  if (typeof description !== "string") {
    // NOTE: 非文字列を機械的に String 化すると "[object Object]" が説明として混入するため捨てる。
    return null;
  }

  const sanitized = description
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(商品の説明|この商品について)\s*/i, "")
    .trim();
  return sanitized.length > 0 ? sanitized : null;
}

function stripAmazonChrome(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/^\s*Amazon(?:\.[\w.]+)?\s*[|:：\-‐]\s*/i, "")
    .replace(/\s*[|:：\-‐]\s*Amazon(?:\.[\w.]+)?\s*$/i, "")
    .replace(/\s*[|:：\-‐]\s*(?:公式サイト|Official\s+Site)\s*$/i, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeComparableText(value: string | null): string {
  if (!value) return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function getAmazonLocaleInfo(hostname: string): { locale: string; currency: string } {
  const normalizedHost = hostname.replace(/^smile\./, "").replace(/^www\./, "");
  const mapping: Record<string, { locale: string; currency: string }> = {
    "amazon.co.jp": { locale: "ja-JP", currency: "JPY" },
    "amazon.com": { locale: "en-US", currency: "USD" },
    "amazon.co.uk": { locale: "en-GB", currency: "GBP" },
    "amazon.de": { locale: "de-DE", currency: "EUR" },
    "amazon.fr": { locale: "fr-FR", currency: "EUR" },
    "amazon.it": { locale: "it-IT", currency: "EUR" },
    "amazon.es": { locale: "es-ES", currency: "EUR" },
    "amazon.ca": { locale: "en-CA", currency: "CAD" },
    "amazon.com.mx": { locale: "es-MX", currency: "MXN" },
    "amazon.com.au": { locale: "en-AU", currency: "AUD" },
    "amazon.in": { locale: "en-IN", currency: "INR" },
    "amazon.com.br": { locale: "pt-BR", currency: "BRL" },
    "amazon.ae": { locale: "ar-AE", currency: "AED" },
    "amazon.sa": { locale: "ar-SA", currency: "SAR" },
    "amazon.sg": { locale: "en-SG", currency: "SGD" },
    "amazon.nl": { locale: "nl-NL", currency: "EUR" },
    "amazon.se": { locale: "sv-SE", currency: "SEK" },
    "amazon.pl": { locale: "pl-PL", currency: "PLN" },
    "amazon.com.tr": { locale: "tr-TR", currency: "TRY" },
    "amazon.com.be": { locale: "nl-BE", currency: "EUR" },
    "amazon.eg": { locale: "ar-EG", currency: "EGP" },
  };

  return mapping[normalizedHost] ?? { locale: "en-US", currency: "USD" };
}

function formatAmazonSitename(hostname: string): string {
  const normalizedHost = hostname.replace(/^smile\./, "").replace(/^www\./, "");
  const suffix = normalizedHost.replace(/^amazon\./i, "");
  return suffix ? `Amazon.${suffix}` : "Amazon";
}


// VRChatのWorldのURLを判定し、World IDを取得する関数
function isVRCUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname === "vrchat.com" ||
      parsedUrl.hostname.endsWith(".vrchat.com")
    ) {
      const pathSegments = parsedUrl.pathname.split("/");
      const appIndex = pathSegments.indexOf("world");
      if (appIndex !== -1 && pathSegments.length > appIndex + 1) {
        return pathSegments[appIndex + 1];
      }
    }
    // ?worldId= のクエリパラメータからワールドIDを取得
    const worldId = parsedUrl.searchParams.get("worldId");
    if (worldId) {
      return worldId;
    }
    return null;
  } catch (error) {
    logger.warn("Invalid URL:", error);
    return null;
  }
}

/**
 * サムネイル等の外部 URL をプロキシ URL へ変換する。
 *
 * @remarks
 * GHSA-3p2w-xmv5-jm95 対策:
 * 以前は http(s) 以外の URL（例: `javascript:` や CSS を破壊する文字列を含む URL）を
 * そのままクライアントへ渡しており、`background-image: url('...')` への
 * スタイルインジェクションに繋がっていた。
 * サムネイルとして妥当なのは http(s) のみなので、それ以外は `null` を返して
 * クライアントへ渡さないようにする。
 *
 * @param url - 変換対象 URL
 * @returns http(s) の場合はプロキシ URL、それ以外は `null`
 */
function wrap(url?: string): string | null {
  if (url == null) return null;
  // http(s) 以外はサムネイルとして扱わない（スタイルインジェクション対策）
  if (!url.match(/^https?:\/\//)) return null;

  // 自インスタンス宛の URL はプロキシを通さずそのまま返す。
  // メディアプロキシは自ホスト宛を 400 で拒否する（GHSA-gq5q-c77c-v236 の増幅 DoS 対策）
  // ため、通すと必ず失敗してサムネイルが空欄になる。
  // プロキシを経由しないぶん query() によるエスケープが効かなくなるので、
  // クライアントの `background-image: url('...')` を破壊しうる文字だけ明示的に潰す。
  // NOTE: encodeURIComponent は ' ( ) を変換しないため使えない。パーセント表記へ自前で置換する。
  try {
    if (new URL(url).host === new URL(config.url).host) {
      return new URL(url).href.replace(
        /['"()\\]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );
    }
  } catch {
    return null;
  }

  return `${config.url}/proxy/preview.webp?${query({
    url,
    preview: "1",
  })}`;
}
