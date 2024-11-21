import type Koa from "koa";
import summaly from "summaly";
import { fetchMeta } from "@/misc/fetch-meta.js";
import Logger from "@/services/logger.js";
import config from "@/config/index.js";
import { query } from "@/prelude/url.js";
import { getJson } from "@/misc/fetch.js";

const logger = new Logger("url-preview");

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

  // SteamのApp IDを取得
  const steamAppId = isSteamUrl(url);

  if (steamAppId) {
    // Steamの場合の処理
    try {
      const steamApiUrl = `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=jp&l=${
        lang ?? "ja"
      }`;

      // getJsonを使用してSteamデータを取得
      const data = await getJson(steamApiUrl);

      const appData = data[steamAppId]?.data;

      if (appData && data[steamAppId].success) {
        // summaryオブジェクトを構築
        const summary = {
          url: url,
          title: appData.name,
          description: "", // 後で設定
          thumbnail: appData.header_image,
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

        // 開発者情報を説明に設定
        summary.description = summary.steam.developer;

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

        // サムネイルとアイコンをラップ
        summary.icon = wrap(summary.icon) ?? "";
        summary.thumbnail = wrap(summary.thumbnail);

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

  // 既存の処理
  try {
    const summary = meta.summalyProxy
      ? await getJson(
          `${meta.summalyProxy}?${query({
            url: url,
            lang: lang ?? "en-US",
          })}`
        )
      : await summaly.default(url, {
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
