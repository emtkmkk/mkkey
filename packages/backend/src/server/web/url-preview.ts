import type Koa from "koa";
import summaly from "summaly";
import cheerio from "cheerio";
import { fetchMeta } from "@/misc/fetch-meta.js";
import Logger from "@/services/logger.js";
import config from "@/config/index.js";
import { query } from "@/prelude/url.js";
import { getHtml, getJson, getResponse } from "@/misc/fetch.js";
import {
  translateWithDeepl,
  formatDeeplTranslationPrefix,
} from "@/services/translation/deepl.js";
import type { Meta } from "@/models/entities/meta.js";

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

const logger = new Logger("url-preview");
const AMAZON_SHORTENER_HOSTNAME_PATTERN = /^(?:www\.)?amzn\.asia$/i;

const SENSITIVE_PREVIEW_FETCH_TIMEOUT_MS = 5000;
const SENSITIVE_PREVIEW_FETCH_SIZE = 65536; // 64KB

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
 * twitter:card summary_large_image または robots に max-image-preview:large があれば true。
 * @internal
 */
function preferLargeThumbnailFromHtml(html: string | null): boolean {
	if (!html) return false;
	const $ = cheerio.load(html);
	const twitterCard =
		$('meta[name="twitter:card"]').attr("content")?.trim() ??
		$('meta[property="twitter:card"]').attr("content")?.trim();
	if (twitterCard === "summary_large_image") return true;
	const robots = $('meta[name="robots"]').attr("content") ?? "";
	if (/max-image-preview:\s*large/i.test(robots)) return true;
	return false;
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

  logger.info(
    meta.summalyProxy
      ? `(Proxy) Getting preview of ${url}@${lang} ...`
      : `Getting preview of ${url}@${lang} ...`
  );

  const redirectedUrl = await resolveShortUrlIfNeeded(url);
  const effectiveUrl = redirectedUrl ?? url;

  // SteamのApp IDを取得
  const steamAppId = isSteamUrl(effectiveUrl);
  const steamPackageId = isSteamPackageUrl(effectiveUrl);
	const steamBundleId = isSteamBundleUrl(effectiveUrl);
  const VRCWorldId = isVRCUrl(effectiveUrl);
  let amazonFetchUrl = effectiveUrl;
  let amazonProduct = isAmazonProductUrl(effectiveUrl);
  const summaryFetchUrl = effectiveUrl;

  if (!amazonProduct) {
    const resolvedAmazonUrl = await resolveAmazonShortUrl(effectiveUrl);
    if (resolvedAmazonUrl) {
      amazonFetchUrl = resolvedAmazonUrl;
      amazonProduct = isAmazonProductUrl(amazonFetchUrl);
    }
  }

  if (steamAppId) {
    // Steamの場合の処理
    try {
      const steamApiUrl = `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=jp&l=${
        lang ?? "ja"
      }`;

      // getJsonを使用してSteamデータを取得
      const data = await getJson(
        steamApiUrl,
        "application/json, */*",
        5000,
        {
          cookie: "steamCountry=JP",
					"accept-language": "ja-jp",
        },
      );

      const appData = data[steamAppId]?.data;

      if (appData && data[steamAppId].success) {


      const _summary = meta.summalyProxy
      ? await getJson(
        `${meta.summalyProxy}?${query({
          url: url,
          lang: lang ?? "en-US",
        })}`,
        "application/json, */*",
        5000,
        {
          cookie: "steamCountry=JP"
        },
        )
      : await summaly.default(url, {
        followRedirects: false,
        lang: lang ?? "en-US",
        });


        // summaryオブジェクトを構築
        const summary = {
          url: url,
          title: appData.name,
          description: appData.short_description,
          thumbnail: "",
          icon: "https://store.steampowered.com/favicon.ico",
          sitename: "Steam",
          player: null as any, // 動画情報を追加
          // 追加のSteam専用データ
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
              ? appData.genres.map((genre) => genre.description).join(", ")
              : "",
            releaseDate: {
				comingSoon: appData.release_date ? appData.release_date.coming_soon : false,
				date: appData.release_date ? appData.release_date.date : "",
			}
          },
        };

        summary.description = await translateDescriptionToJapaneseIfNeeded(
          summary.description,
          meta,
        );

        // サムネイルとアイコンをラップ
        summary.icon = wrap(_summary.icon) ?? "";
        summary.thumbnail = wrap(_summary.thumbnail) ?? "";
        // Steam: 17歳以上制限ならセンシティブ。ページ固有サムネイルがあれば大きい表示を希望
        summary.isSensitive =
          appData.required_age != null &&
          parseInt(String(appData.required_age), 10) >= 17;
        summary.preferLargeThumbnail = !!summary.thumbnail;

                /*
        // 動画情報をplayerにセット
        if (appData.movies && Array.isArray(appData.movies)) {
          const highlightedMovies = appData.movies.filter(
            (movie) => movie.highlight
          );
          if (highlightedMovies.length > 0) {
            // IDでソートして最も古い動画を取得
            highlightedMovies.sort((a, b) => a.id - b.id);
            const oldestMovie = highlightedMovies[0];
            if (oldestMovie.webm && oldestMovie.webm["480"]) {
              summary.player = {
                url: oldestMovie.webm["480"],
                width: oldestMovie.width,
                height: oldestMovie.height,
              };
            }
          }
        }
		*/

        // Cache 7days
        ctx.set("Cache-Control", "max-age=604800, immutable");

        ctx.body = summary;
        return;
      } else {
        throw new Error("Failed to get Steam app data");
      }
    } catch (err) {
      logger.warn(`Failed to get Steam data for ${url}: ${err}`);
      ctx.status = 200;
      ctx.set("Cache-Control", "max-age=86400, immutable");
      ctx.body = "{}";
      return;
    }
  }


  if (steamPackageId) {
    // SteamPackageの場合の処理
    try {
      const steamApiUrl = `https://store.steampowered.com/api/packagedetails?packageids=${steamPackageId}&cc=jp&l=${
        lang ?? "ja"
      }`;

      // getJsonを使用してSteamデータを取得
      const data = await getJson(
        steamApiUrl,
        "application/json, */*",
        5000,
        {
          cookie: "steamCountry=JP",
					"accept-language": "ja-jp",
        },
      );

      const subData = data[steamPackageId]?.data;

      if (subData && data[steamPackageId].success) {


      const _summary = meta.summalyProxy
      ? await getJson(
        `${meta.summalyProxy}?${query({
          url: url,
          lang: lang ?? "en-US",
        })}`,
        "application/json, */*",
        5000,
        {
          cookie: "steamCountry=JP"
        },
        )
      : await summaly.default(url, {
        followRedirects: false,
        lang: lang ?? "en-US",
        });


        // summaryオブジェクトを構築
        const summary = {
          url: url,
          title: subData.name,
          description: subData.page_content?.split("\r\n")?.[0]?.slice(0, 160),
          thumbnail: "",
          icon: "https://store.steampowered.com/favicon.ico",
          sitename: "Steam",
          player: null as any, // 動画情報を追加
          // 追加のSteam専用データ
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
              ? subData.genres.map((genre) => genre.description).join(", ")
              : "",
            releaseDate: {
				comingSoon: subData.release_date ? subData.release_date.coming_soon : false,
				date: subData.release_date ? subData.release_date.date : "",
			}
          },
        };
        summary.description = await translateDescriptionToJapaneseIfNeeded(
          summary.description,
          meta,
        );

        // サムネイルとアイコンをラップ
        summary.icon = wrap(_summary.icon) ?? "";
        summary.thumbnail = wrap(_summary.thumbnail) ?? "";
        // Steam: 17歳以上制限ならセンシティブ。ページ固有サムネイルがあれば大きい表示を希望
        summary.isSensitive =
          subData.required_age != null &&
          parseInt(String(subData.required_age), 10) >= 17;
        summary.preferLargeThumbnail = !!summary.thumbnail;

        // Cache 7days
        ctx.set("Cache-Control", "max-age=604800, immutable");

        ctx.body = summary;
        return;
      } else {
        throw new Error("Failed to get Steam app data");
      }
    } catch (err) {
      logger.warn(`Failed to get Steam data for ${url}: ${err}`);
      ctx.status = 200;
      ctx.set("Cache-Control", "max-age=86400, immutable");
      ctx.body = "{}";
      return;
    }
  }

  if (steamBundleId) {
    // SteamBundleの場合の処理
    try {
      const steamApiUrl = `https://store.steampowered.com/actions/ajaxresolvebundles?bundleids=${steamBundleId}&cc=jp&l=${
        lang ?? "ja"
      }`;

      // getJsonを使用してSteamデータを取得
      const data = await getJson(
        steamApiUrl,
        "application/json, */*",
        5000,
        {
          cookie: "steamCountry=JP",
					"accept-language": "ja-jp",
        },
      );

			const bundleData = data && Array.isArray(data) && data.length > 0 ? data[0] : undefined;

      if (bundleData) {

      const _summary = meta.summalyProxy
      ? await getJson(
        `${meta.summalyProxy}?${query({
          url: url,
          lang: lang ?? "en-US",
        })}`,
        "application/json, */*",
        5000,
        {
          cookie: "steamCountry=JP"
        },
        )
      : await summaly.default(url, {
        followRedirects: false,
        lang: lang ?? "en-US",
        });


        // summaryオブジェクトを構築
        const summary = {
          url: url,
          title: bundleData.name,
          description: bundleData.appids?.length ? `バンドル - ${bundleData.appids?.length} 個のコンテンツ` : "",
          thumbnail: "",
          icon: "https://store.steampowered.com/favicon.ico",
          sitename: "Steam",
          player: null as any, // 動画情報を追加
          // 追加のSteam専用データ
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
						}
          },
        };

        // サムネイルとアイコンをラップ
        summary.icon = wrap(_summary.icon) ?? "";
        summary.thumbnail = wrap(_summary.thumbnail) ?? "";
        // バンドルは年齢制限なしとして扱う。ページ固有サムネイルがあれば大きい表示を希望
        summary.isSensitive = false;
        summary.preferLargeThumbnail = !!summary.thumbnail;

        // Cache 7days
        ctx.set("Cache-Control", "max-age=604800, immutable");

        ctx.body = summary;
        return;
      } else {
        throw new Error("Failed to get Steam app data");
      }
    } catch (err) {
      logger.warn(`Failed to get Steam data for ${url}: ${err}`);
      ctx.status = 200;
      ctx.set("Cache-Control", "max-age=86400, immutable");
      ctx.body = "{}";
      return;
    }
  }

  if (amazonProduct) {
    try {
      const localeInfo = getAmazonLocaleInfo(amazonProduct.hostname);
      const normalizedLang = normalizeLang(lang ?? localeInfo.locale);
      const res = await getResponse({
        url: amazonFetchUrl,
        method: "GET",
        headers: {
          Accept: "text/html, */*",
          "accept-language": normalizedLang,
        },
        timeout: 10000,
      });
      const html = await res.text();

      const productData = extractAmazonProductData(html);
      const fallbackData = extractAmazonFallbackData(html);

      if (!productData && !fallbackData) throw new Error("product data not found");

      const description = sanitizeAmazonDescription(
        productData?.description ?? fallbackData?.description ?? null,
      );
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

      const iconHost = amazonProduct.hostname.replace(/^smile\./, "");
      const favicon = `https://${iconHost}/favicon.ico`;

      const wrappedThumbnail = wrap(image) ?? "";
      const isSensitive = isSensitiveFromHeadersAndHtml(res.headers, html);
      // ページ固有のサムネイルがあれば大きい表示を希望
      const preferLargeThumbnail = !!wrappedThumbnail;

      const summary = {
        url,
        title:
          productData?.name ??
          productData?.headline ??
          fallbackData?.title ??
          "Amazon",
        description,
        thumbnail: wrappedThumbnail,
        icon: wrap(favicon) ?? favicon,
        sitename: formatAmazonSitename(iconHost),
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

      ctx.set("Cache-Control", "max-age=604800, immutable");
      ctx.body = summary;
      return;
    } catch (err) {
      logger.warn(`Failed to get Amazon data for ${url}: ${err}`);
      // フォールバックとして通常のサマリーを取得する
    }
  }

  // 既存の処理
  try {
    const summary = meta.summalyProxy
      ? await getJson(
          `${meta.summalyProxy}?${query({
            url: summaryFetchUrl,
            lang: lang ?? "en-US",
          })}`
        )
      : await summaly.default(summaryFetchUrl, {
          followRedirects: false,
          lang: lang ?? "en-US",
        });

    logger.succ(`Got preview of ${url}: ${summary.title}`);

    if (
      summary.url &&
      !(
        summary.url.startsWith("http://") ||
        summary.url.startsWith("https://")
      )
    ) {
      throw new Error("unsupported schema included");
    }

    if (
      summary.player?.url &&
      !(
        summary.player.url.startsWith("http://") ||
        summary.player.url.startsWith("https://")
      )
    ) {
      throw new Error("unsupported schema included");
    }

    if (VRCWorldId) {
      // VRCの場合の処理
      const VRCApiUrl = `https://api.vrchat.cloud/api/1/worlds/${VRCWorldId}`;

      // getJsonを使用してSteamデータを取得
      const data = await getJson(
        VRCApiUrl,
        "application/json, */*",
        5000,
      );

      if (data.name) {
        summary.title = [data.name, data.authorName, "VRChat"].filter(Boolean).join(" - ");
        summary.description = data.description || summary.description;
        summary.thumbnail = data.imageUrl || data.thumbnailImageUrl || summary.thumbnail;
      }
    }

    let googleMapsThumbnailAssigned = false;
    if (isGoogleMapsUrl(effectiveUrl)) {
      const googleMapsResult = await enrichGoogleMapsSummaryWithoutApiKey(
        effectiveUrl,
        summary,
        lang,
      );
      googleMapsThumbnailAssigned = googleMapsResult.thumbnailAssignedByGoogleMaps;
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
        size: SENSITIVE_PREVIEW_FETCH_SIZE,
      });
      const sensitiveHtml = await sensitiveRes.text();
      summaryIsSensitive = isSensitiveFromHeadersAndHtml(
        sensitiveRes.headers,
        sensitiveHtml,
      );
      summaryPreferLargeThumbnail =
        preferLargeThumbnailFromHtml(sensitiveHtml) && !!summary.thumbnail;
    } catch (err) {
      logger.debug(`Sensitive/preferLarge check fetch failed for ${url}: ${err}`);
    }

    // VRC 専用処理でサムネイルを付与した場合は大きい表示を希望
    if (VRCWorldId && !!summary.thumbnail) {
      summaryPreferLargeThumbnail = true;
    }
    // Google Maps 専用処理でサムネイルを付与した場合のみ大きい表示を希望
    if (googleMapsThumbnailAssigned) {
      summaryPreferLargeThumbnail = true;
    }

    summary.isSensitive = summaryIsSensitive;
    summary.preferLargeThumbnail = summaryPreferLargeThumbnail;

    summary.icon = wrap(summary.icon);
    summary.thumbnail = wrap(summary.thumbnail);
    // Cache 7days
    ctx.set("Cache-Control", "max-age=604800, immutable");

    ctx.body = summary;
  } catch (err) {
    logger.warn(`Failed to get preview of ${url}: ${err}`);
    ctx.status = 200;
    ctx.set("Cache-Control", "max-age=86400, immutable");
    ctx.body = "{}";
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

type GoogleMapsMapType = "place" | "search" | "dir" | "map";

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

type GoogleMapsUrlMeta = {
  placeCandidate: string | null;
  addressCandidate: string | null;
  latLng: string | null;
  zoom: string | null;
  mapType: GoogleMapsMapType;
};

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
    const sourceA = extractGoogleMapsUrlMetadata(effectiveUrl);
    if (sourceA.placeCandidate || sourceA.addressCandidate || sourceA.latLng) {
      adoptedSources.add("A");
    }

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

    if (sourceA.addressCandidate || sourceA.latLng || sourceA.mapType || sourceA.zoom) {
      adoptedSources.add("D");
    }

    const existingTitle = typeof summary.title === "string" ? summary.title : null;
    const existingTitleIsSpecific = !!existingTitle && !isGenericGoogleMapsTitle(existingTitle);

    const preferredTitle =
      sourceC?.name ??
      sourceB?.ogTitle ??
      sourceB?.twitterTitle ??
      sourceB?.documentTitle ??
      sourceA.placeCandidate ??
      existingTitle ??
      null;

    if (!existingTitleIsSpecific && preferredTitle) {
      summary.title = preferredTitle;
    }

    const addressCandidate =
      sourceC?.address ??
      extractAddressLikeText(sourceB?.ogDescription) ??
      extractAddressLikeText(sourceB?.twitterDescription) ??
      extractAddressLikeText(sourceB?.metaDescription) ??
      sourceA.addressCandidate ??
      null;
    const categoryCandidate = sourceC?.category ?? null;

    const builtDescription = buildGoogleMapsDescription({
      address: addressCandidate,
      category: categoryCandidate,
      latLng: sourceA.latLng,
      mapType: sourceA.mapType,
      zoom: sourceA.zoom,
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

function extractGoogleMapsPlaceTitle(url: string): string | null {
  return extractGoogleMapsUrlMetadata(url).placeCandidate;
}

function extractGoogleMapsUrlMetadata(url: string): GoogleMapsUrlMeta {
  const empty: GoogleMapsUrlMeta = {
    placeCandidate: null,
    addressCandidate: null,
    latLng: null,
    zoom: null,
    mapType: "map",
  };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return empty;
  }

  if (!isGoogleMapsHostname(parsedUrl.hostname)) {
    return empty;
  }

  const mapType = detectGoogleMapsMapType(parsedUrl.pathname);
  const placeFromPath = extractGoogleMapsPlaceFromPath(parsedUrl.pathname);
  const queryCandidates = ["q", "query", "destination", "daddr"];
  let queryPlace: string | null = null;
  for (const key of queryCandidates) {
    const value = parsedUrl.searchParams.get(key);
    const sanitized = sanitizeGoogleMapsPlaceCandidate(value);
    if (sanitized) {
      queryPlace = sanitized;
      break;
    }
  }

  const addressCandidate =
    queryPlace ??
    sanitizeGoogleMapsPlaceCandidate(parsedUrl.searchParams.get("saddr")) ??
    placeFromPath;

  const zoom = sanitizeGoogleMapsZoomCandidate(
    parsedUrl.searchParams.get("z") ?? parsedUrl.searchParams.get("zoom"),
  );

  const latLng =
    extractGoogleMapsLatLngFromPath(parsedUrl.pathname) ??
    sanitizeGoogleMapsLatLng(parsedUrl.searchParams.get("ll")) ??
    sanitizeGoogleMapsLatLng(parsedUrl.searchParams.get("center"));

  return {
    placeCandidate: placeFromPath ?? queryPlace,
    addressCandidate,
    latLng,
    zoom,
    mapType,
  };
}

function detectGoogleMapsMapType(pathname: string): GoogleMapsMapType {
  const lowered = pathname.toLowerCase();
  if (lowered.includes("/maps/place")) return "place";
  if (lowered.includes("/maps/search")) return "search";
  if (lowered.includes("/maps/dir")) return "dir";
  return "map";
}

function sanitizeGoogleMapsLatLng(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const matched = candidate.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!matched) return null;
  return `${matched[1]},${matched[2]}`;
}

function sanitizeGoogleMapsZoomCandidate(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const matched = candidate.match(/\d+(?:\.\d+)?/);
  return matched?.[0] ?? null;
}

function extractGoogleMapsLatLngFromPath(pathname: string): string | null {
  const matched = pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (!matched) return null;
  return `${matched[1]},${matched[2]}`;
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
      const name = sanitizeGoogleMapsPlaceCandidate(stringFromUnknown(obj.name));
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
  return candidate ?? sanitized;
}

function buildGoogleMapsDescription(args: {
  address: string | null;
  category: string | null;
  latLng: string | null;
  mapType: GoogleMapsMapType;
  zoom: string | null;
  fallback: string | null;
}): string | null {
  const segments: string[] = [];

  if (args.address) {
    segments.push(`住所: ${args.address}`);
  }
  if (args.category) {
    segments.push(`カテゴリ: ${args.category}`);
  }
  if (args.latLng) {
    segments.push(`座標: ${args.latLng}`);
  }
  if (args.mapType !== "map") {
    segments.push(`リンク種別: ${args.mapType}`);
  }
  if (args.zoom) {
    segments.push(`ズーム: ${args.zoom}`);
  }

  if (segments.length > 0) {
    return segments.join(" / ");
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

function extractGoogleMapsPlaceFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const placeIndex = segments.findIndex((segment) => segment.toLowerCase() === "place");
  if (placeIndex !== -1 && segments.length > placeIndex + 1) {
    const candidate = segments[placeIndex + 1];
    return sanitizeGoogleMapsPlaceCandidate(candidate);
  }

  if (segments[0]?.toLowerCase() === "maps" && segments.length > 1) {
    return sanitizeGoogleMapsPlaceCandidate(segments[1]);
  }

  return null;
}

function sanitizeGoogleMapsPlaceCandidate(candidate: string | null | undefined): string | null {
  if (!candidate) return null;

  const decoded = decodeURIComponentSafe(candidate)
    .replace(/\+/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!decoded) return null;

  if (/^@[-\d.]+,[-\d.]+,/.test(decoded)) {
    return null;
  }

  const loweredDecoded = decoded.toLowerCase();
  if (
    loweredDecoded === "maps" ||
    loweredDecoded === "search" ||
    loweredDecoded === "dir" ||
    loweredDecoded === "place"
  ) {
    return null;
  }

  return decoded;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
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

function extractAmazonFallbackData(html: string): AmazonFallbackData | null {
  const $ = cheerio.load(html);

  const title = cleanAmazonText(
    $("#title").text() ||
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      $("title").first().text(),
  );

  const description = cleanAmazonText(
    $("#productDescription").text() ||
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content"),
  );

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

  const availability = cleanAmazonText(
    $("#availability span").text() ||
      $("div#availability span").text() ||
      $("span[data-availability]").attr("data-availability"),
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

function cleanAmazonAttr(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAmazonRatingValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([0-9]+[.,]?[0-9]*)/);
  if (!match) return null;
  const normalized = match[1].replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmazonInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAmazonBrand(value: string | null | undefined): string | null {
  const text = cleanAmazonText(value);
  if (!text) return null;
  const normalized = text
    .replace(/^ブランド[:：]?\s*/i, "")
    .replace(/^Brand[:：]?\s*/i, "")
    .replace(/^Visit the\s+/i, "")
    .replace(/\s+Store$/i, "")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

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
    if (types.some((t) => typeof t === "string" && t.toLowerCase() === "product")) {
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

  return {
    value: value != null ? Number(value) : null,
    best: best != null ? Number(best) : null,
    count: count != null ? Number(count) : null,
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
    return description == null ? null : cleanAmazonText(String(description));
  }

  const sanitized = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return sanitized.length > 0 ? sanitized : null;
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

function wrap(url?: string): string | null {
  return url != null
    ? url.match(/^https?:\/\//)
      ? `${config.url}/proxy/preview.webp?${query({
          url,
          preview: "1",
        })}`
      : url
    : null;
}
