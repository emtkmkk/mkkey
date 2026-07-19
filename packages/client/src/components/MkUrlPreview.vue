<template>
	<div
	  v-if="playerEnabled && isPlayerUrlSafe"
	  class="player"
	  :style="`padding: ${
		((player.height || 0) / (player.width || 1)) * 100
	  }% 0 0`"
	  @click.stop
	>
	  <button
		class="disablePlayer"
		:title="i18n.ts.disablePlayer"
		@click="playerEnabled = false"
	  >
		<i class="ph-x ph-bold ph-lg"></i>
	  </button>
	  <iframe
		:src="
		  (player.url ?? '') +
		  ((player.url ?? '').match(/\?/)
			? '&autoplay=1&auto_play=1'
			: '?autoplay=1&auto_play=1')
		"
		:width="player.width || '100%'"
		:height="player.height || 250"
		frameborder="0"
		allow="autoplay; encrypted-media"
		allowfullscreen
	  />
        </div>

        <div
          v-else-if="isSteam"
          class="mk-url-preview steam"
	  :class="{ legacyStyle: useLegacyStyle }"
	  @click.stop
	>
	  <MkButton
		v-if="showThumbnailButtonVisible"
		class="showThumbnail"
		:small="true"
		@click="showThumbnail = true"
	  >
		<i class="ph-image ph-bold ph-lg"></i> {{ i18n.ts.showThumbnail }}
	  </MkButton>
	  <transition :name="$store.state.animation ? 'zoom' : ''" mode="out-in">
		<component
		  :is="self ? 'MkA' : 'a'"
		  v-if="!fetching"
		  class="link"
		  :class="{ compact: compact || useLegacyStyle }"
		  :[attr]="self ? url.substr(local.length) : url"
		  rel="nofollow noopener"
		  :target="target"
		  :title="url"
		>
		  <div
			v-if="showThumbnailArea && thumbnailImageVisible"
			class="thumbnail"
			:style="{ backgroundImage: `url('${thumbnail}')` }"
		  >
			<button
			  v-if="!playerEnabled && player.url && isPlayerUrlSafe"
			  class="_button"
			  :title="i18n.ts.enablePlayer"
			  @click.prevent="playerEnabled = true"
			>
			  <i class="ph-play-circle ph-bold ph-7x"></i>
			</button>
		  </div>
		  <div
			v-else-if="showThumbnailArea && thumbnailPlaceholderVisible"
			class="thumbnail thumbnail-placeholder"
		  >
			{{ i18n.ts._urlPreview.sensitive }}
		  </div>
		  <article>
			<header>
			  <h1 :title="steamGameName">
				<img v-if="icon" :src="icon" alt="Favicon" class="favicon" />
				<span v-if="steamAgeLimit" style="margin-right:0.5em">[{{ steamAgeLimit }}+] </span>{{ steamGameName }}
			  </h1>
			  <div class="developer-release">
				<span v-if="steamDeveloper" class="steam-developer">{{ steamDeveloper }}</span>
				<span v-if="steamDeveloper && (steamReleaseDate && !steamComingSoon)"> | </span>
				<span v-if="steamReleaseDate && !steamComingSoon">{{ steamReleaseDate }} リリース</span>
			  </div>
			<div class="steam-genres" v-if="steamComingSoon">リリース前<span v-if="steamReleaseDate"> リリース日: {{ steamReleaseDate }}</span></div>
			<div class="steam-genres" v-if="steamGenres">{{ steamGenres }}</div>
			</header>
			<p v-if="description" :title="description">
			  {{
				description.length > 250
				  ? `${description.slice(0, 250)}…`
				  : description
			  }}
			</p>
			<footer class="steam-row steam-pricing">
			  <span v-if="steamOnSale" class="steam-discount">
				-{{ Math.floor(steamDiscount * 10) / 10 }}%
			  </span>
			  <span v-if="steamOnSale" class="steam-original-price">
				{{ steamOriginalPrice }}
			  </span>
			  <span class="steam-current-price">
				{{ steamCurrentPrice }}
			  </span>
			</footer>
		  </article>
		</component>
	  </transition>
        </div>
        <div
          v-else-if="isAmazon"
          class="mk-url-preview amazon"
          :class="{ legacyStyle: useLegacyStyle }"
          @click.stop
        >
          <MkButton
                v-if="showThumbnailButtonVisible"
                class="showThumbnail"
                :small="true"
                @click="showThumbnail = true"
          >
                <i class="ph-image ph-bold ph-lg"></i> {{ i18n.ts.showThumbnail }}
          </MkButton>
          <transition :name="$store.state.animation ? 'zoom' : ''" mode="out-in">
                <component
                  :is="self ? 'MkA' : 'a'"
                  v-if="!fetching"
                  class="link"
                  :class="{ compact: compact || useLegacyStyle }"
                  :[attr]="self ? url.substr(local.length) : url"
                  rel="nofollow noopener"
                  :target="target"
                  :title="url"
                >
                  <div
                        v-if="showThumbnailArea && thumbnailImageVisible"
                        class="thumbnail"
                        :style="{ backgroundImage: `url('${thumbnail}')` }"
                  >
                        <button
                          v-if="!playerEnabled && player.url && isPlayerUrlSafe"
                          class="_button"
                          :title="i18n.ts.enablePlayer"
                          @click.prevent="playerEnabled = true"
                        >
                          <i class="ph-play-circle ph-bold ph-7x"></i>
                        </button>
                  </div>
                  <div
                        v-else-if="showThumbnailArea && thumbnailPlaceholderVisible"
                        class="thumbnail thumbnail-placeholder"
                  >
                        {{ i18n.ts._urlPreview.sensitive }}
                  </div>
                  <article>
                        <header>
                          <h1 :title="amazonDisplayTitleTooltip">
                                {{ amazonDisplayTitle }}
                          </h1>
                          <div class="amazon-brand" v-if="amazonBrand">{{ amazonBrand }}</div>
                        </header>
                        <p v-if="description" :title="description">
                          {{
                                description.length > 250
                                  ? `${description.slice(0, 250)}…`
                                  : description
                          }}
                        </p>
                        <footer class="amazon-footer">
                          <div class="amazon-price-row" v-if="amazonPriceDisplay || amazonPrime">
                                <span class="amazon-price" v-if="amazonPriceDisplay">
                                  {{ amazonDisplayPrice }}
                                </span>
                                <span class="amazon-prime-badge" v-if="amazonPrime">Prime</span>
                          </div>
                          <div class="amazon-rating" v-if="amazonRatingValue !== null">
                                <span class="amazon-star">★</span>
                                <span class="amazon-rating-value">
                                  {{ formatRatingValue(amazonRatingValue) }}
                                </span>
                                <span class="amazon-rating-count" v-if="amazonRatingCount !== null">
                                  {{ formatAmazonReviewCount(amazonRatingCount) }}
                                </span>
                          </div>
                          <div class="amazon-availability" v-if="amazonAvailability">
                                {{ amazonAvailability }}
                          </div>
                          <div class="amazon-site-info" v-if="icon || sitename">
                                <img
                                  v-if="icon"
                                  class="amazon-site-icon"
                                  :src="icon"
                                  @error="icon = ''"
                                />
                                <p
                                  v-if="sitename"
                                  class="amazon-site-name"
                                  :title="displaySitename"
                                >
                                  {{ displaySitename }}
                                </p>
                          </div>
                        </footer>
                  </article>
                </component>
          </transition>
        </div>
        <div
          v-else-if="tweetId && tweetExpanded"
          ref="twitter"
          class="twitter"
          @click.stop
	>
	  <iframe
		ref="tweet"
		allow="fullscreen;web-share"
		scrolling="no"
		frameborder="no"
		:style="{
		  position: 'relative',
		  width: '100%',
		  height: `${tweetHeight}px`,
		}"
		:src="`https://platform.twitter.com/embed/index.html?embedId=${embedId}&amp;hideCard=false&amp;hideThread=false&amp;lang=en&amp;theme=${
		  $store.state.darkMode ? 'dark' : 'light'
		}&amp;id=${tweetId}`"
	  ></iframe>
	</div>
	<div
	  v-else-if="!failed"
	  v-size="{ max: [400, 350] }"
	  class="mk-url-preview"
	  :class="{ legacyStyle: useLegacyStyle }"
	  @click.stop
	>
	  <MkButton
		v-if="tweetId"
		:small="true"
		class="expandTweet"
		@click="tweetExpanded = true"
	  >
		{{ i18n.ts.expandTweet }}
	  </MkButton>
	  <MkButton
		v-if="showThumbnailButtonVisible"
		class="showThumbnail"
		:small="true"
		@click="showThumbnail = true"
	  >
		<i class="ph-image ph-bold ph-lg"></i> {{ i18n.ts.showThumbnail }}
	  </MkButton>
	  <transition :name="$store.state.animation ? 'zoom' : ''" mode="out-in">
		<component
		  :is="self ? 'MkA' : 'a'"
		  v-if="!fetching"
		  class="link"
		  :class="{ compact: compact || useLegacyStyle }"
		  :[attr]="self ? url.substr(local.length) : url"
		  rel="nofollow noopener"
		  :target="target"
		  :title="url"
		>
		  <div
			v-if="showThumbnailArea && thumbnailImageVisible"
			class="thumbnail"
			:style="{ backgroundImage: `url('${thumbnail}')` }"
		  >
			<button
			  v-if="!playerEnabled && player.url && isPlayerUrlSafe"
			  class="_button"
			  :title="i18n.ts.enablePlayer"
			  @click.prevent="playerEnabled = true"
			>
			  <i class="ph-play-circle ph-bold ph-7x"></i>
			</button>
		  </div>
		  <div
			v-else-if="showThumbnailArea && thumbnailPlaceholderVisible"
			class="thumbnail thumbnail-placeholder"
		  >
			{{ i18n.ts._urlPreview.sensitive }}
		  </div>
		  <article>
			<header>
			  <h1 :title="title">{{ title }}</h1>
			</header>
			<p v-if="description" :title="description">
			  {{
				description.length > 85
				  ? `${description.slice(0, 85)}…`
				  : description
			  }}
			</p>
			<footer>
			  <img
				v-if="icon && !isSteam"
				class="icon"
				:src="icon"
				@error="icon = ''"
			  />
			  <p v-if="!isSteam" :title="displaySitename">{{ displaySitename }}</p>
			</footer>
		  </article>
		</component>
	  </transition>
	</div>
  </template>
  <script lang="ts" setup>
  /**
   * @packageDocumentation
   *
   * 外部 URL のカードプレビュー（OGP・Steam・Amazon・埋め込みプレイヤー等）。
   *
   * @remarks
   * NOTE: `/url` には `normalizeUrlForPreviewFetch` 済みの URL を渡す（music.youtube.com の初回失敗を防ぐ）。
   * NOTE: クエリにクライアント `version` を付与し、デプロイでバージョンが変わったときブラウザの `/url` 応答キャッシュを別 URL として切り替える。
   *
   * @public
   */
  import { computed, onUnmounted } from "vue";
  import { url as local, lang, version } from "@/config";
  import { i18n } from "@/i18n";
  import { defaultStore } from "@/store";
  import MkButton from "@/components/MkButton.vue";
  import { normalizeUrlForPreviewFetch } from "@/scripts/normalize-url-for-preview-fetch";

  const props = withDefaults(
	defineProps<{
	  url: string;
	  detail?: boolean;
	  compact?: boolean;
	}>(),
	{
	  detail: false,
	  compact: false,
	}
  );

const self = props.url.startsWith(local);
const attr = self ? "to" : "href";
const target = self ? null : "_blank";
const normalizedLang = (lang || "ja-JP")
  .replace("ja-KS", "ja-JP")
  .replace("ja-KK", "ja-JP");

function createNumberFormatter(
  locale: string,
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch (error) {
    console.warn("Failed to create Intl.NumberFormat", error);
    return new Intl.NumberFormat("en-US", options);
  }
}

const countFormatter = createNumberFormatter(normalizedLang);
const ratingFormatter = createNumberFormatter(normalizedLang, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatRatingValue = (value: number | null) =>
  value == null ? "" : ratingFormatter.format(value);
const formatCountValue = (value: number | null) =>
  value == null ? "" : countFormatter.format(value);
const formatAmazonReviewCount = (value: number | null) => {
  if (value == null) return "";
  return i18n.t("_urlPreview.amazonReviewCount", {
    n: formatCountValue(value),
  });
};
const formatCurrencyValue = (value: number | null, currency: string | null) => {
  if (value == null || !currency) return null;
  try {
    return new Intl.NumberFormat(normalizedLang, {
      style: "currency",
      currency,
    }).format(value);
  } catch (error) {
    console.warn("Failed to format currency", error);
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(value);
    } catch {
      return value.toString();
    }
  }
};

type UrlPreviewPlayerState = {
  url: string | null;
  width: number | null;
  height: number | null;
};

/**
 * URLプレビューの player を常に同じ形へ正規化する。
 *
 * @remarks
 * NOTE: API 応答の `player` は null を取りうるため、そのまま代入すると `player.url` 参照でクラッシュする。
 * NOTE: この関数で null/不正値を吸収し、テンプレート側の参照を安全に保つ。
 *
 * @param rawPlayer - API応答の player
 * @returns url/width/height を持つ正規化済みオブジェクト
 *
 * @internal
 */
function normalizeUrlPreviewPlayer(rawPlayer: unknown): UrlPreviewPlayerState {
  if (!rawPlayer || typeof rawPlayer !== "object") {
    return {
      url: null,
      width: null,
      height: null,
    };
  }

  const candidate = rawPlayer as {
    url?: unknown;
    width?: unknown;
    height?: unknown;
  };

  return {
    url: typeof candidate.url === "string" ? candidate.url : null,
    width: typeof candidate.width === "number" ? candidate.width : null,
    height: typeof candidate.height === "number" ? candidate.height : null,
  };
}

const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/**
 * 文字列を見た目の1文字単位（grapheme）で切り詰める。
 *
 * @remarks
 * NOTE: `slice` の UTF-16 単位切り詰めだと絵文字や結合文字が壊れる可能性があるため、
 * Intl.Segmenter が使える環境では grapheme 単位で切り詰める。
 *
 * @param value - 対象文字列
 * @param maxLength - 最大文字数
 * @returns 切り詰め後文字列と切り詰め有無
 *
 * @internal
 */
function truncateByGrapheme(
  value: string,
  maxLength: number,
): { text: string; truncated: boolean } {
  if (!graphemeSegmenter) {
    const truncated = value.length > maxLength;
    return {
      text: truncated ? `${value.slice(0, maxLength)}…` : value,
      truncated,
    };
  }

  const segments = Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment);
  if (segments.length <= maxLength) {
    return { text: value, truncated: false };
  }

  return {
    text: `${segments.slice(0, maxLength).join("")}…`,
    truncated: true,
  };
}

  let fetching = $ref(true);
  // 取得失敗（サーバが url 無しの error 応答を返した場合等）。
  // NOTE: 失敗時に空のプレビュー枠を出さないため、テンプレート側で全体を非表示にする。
  let failed = $ref(false);
  let title = $ref<string | null>(null);
  let description = $ref<string | null>(null);
  let thumbnail = $ref<string | null>(null);
  let icon = $ref<string | null>(null);
  let sitename = $ref<string | null>(null);
  let player = $ref<UrlPreviewPlayerState>({
	url: null,
	width: null,
	height: null,
  });
  let playerEnabled = $ref(false);
  let showThumbnail = $ref(false);
  let tweetId = $ref<string | null>(null);
  let tweetExpanded = $ref(defaultStore.state.alwaysXExpand || props.detail);
  const embedId = `embed${Math.random().toString().replace(/\D/, "")}`;
  let tweetHeight = $ref(150);
  let isSensitive = $ref(false);
  let preferLargeThumbnail = $ref(false);

  const showThumbnailArea = computed(
    () => defaultStore.state.linkPreviewThumbnailSize !== "none",
  );
  // 「常に表示しない」のときはサムネイルなしと同じ表示にするため、legacyStyle（コンパクト用余白）は使わない
  const useLegacyStyle = computed(() => {
    const s = defaultStore.state.linkPreviewThumbnailSize;
    return s === "compact" || (s === "auto" && !preferLargeThumbnail);
  });
  const thumbnailImageVisible = computed(
    () =>
      showThumbnailArea.value &&
      !!thumbnail &&
      (!isSensitive || defaultStore.state.showSensitiveLinkPreviewThumbnail) &&
      (showThumbnail || !defaultStore.state.enableDataSaverMode),
  );
  const thumbnailPlaceholderVisible = computed(
    () =>
      showThumbnailArea.value &&
      isSensitive &&
      !defaultStore.state.showSensitiveLinkPreviewThumbnail,
  );
  const showThumbnailButtonVisible = computed(
    () =>
      !!thumbnail &&
      defaultStore.state.enableDataSaverMode &&
      !showThumbnail &&
      showThumbnailArea.value &&
      (!isSensitive || defaultStore.state.showSensitiveLinkPreviewThumbnail),
  );
  /**
   * 埋め込みプレイヤーの URL が http(s) かどうか。
   *
   * @remarks
   * GHSA-vc39-c453-67g3 対策（多層防御）:
   * サーバ側でもスキーマ検証しているが、クライアント側でも iframe の src が
   * http(s) の場合のみプレイヤーを描画し、`javascript:` 等の危険なスキームを
   * 埋め込まないようにする。
   */
  const isPlayerUrlSafe = computed(() => {
    const u = player.url ?? "";
    return u.startsWith("http://") || u.startsWith("https://");
  });
  const amazonDisplayTitle = computed(() => {
    if (!title) return "";
    return truncateByGrapheme(title, 60).text;
  });
  const amazonDisplayTitleTooltip = computed(() => {
    if (!title) return undefined;
    return truncateByGrapheme(title, 60).truncated ? title : undefined;
  });
  const displaySitename = computed(() => (sitename || "").trim());
  const amazonDisplayPrice = computed(() => {
    if (!amazonPriceDisplay) return "";
    // NOTE: 価格は「半角¥ + 半角スペース」に統一表示する。
    return amazonPriceDisplay.replace(/^￥\s*/, "¥ ");
  });

// Steam専用のリアクティブ変数
let isSteam = $ref(false);
let steamAgeLimit = $ref<string | null>(null);
let steamGameName = $ref<string>("");
  let steamDeveloper = $ref<string>("");
  let steamOnSale = $ref(false);
  let steamDiscount = $ref<number>(0);
  let steamOriginalPrice = $ref<string | null>(null);
  let steamCurrentPrice = $ref<string | null>(null);
let steamGenres = $ref<string>("");
      let steamComingSoon = $ref(false);
let steamReleaseDate = $ref<string>("");

// Amazon専用のリアクティブ変数
let isAmazon = $ref(false);
let amazonPriceDisplay = $ref<string | null>(null);
let amazonPriceValue = $ref<number | null>(null);
let amazonPriceCurrency = $ref<string | null>(null);
let amazonAvailability = $ref<string | null>(null);
let amazonPrime = $ref(false);
let amazonRatingValue = $ref<number | null>(null);
let amazonRatingCount = $ref<number | null>(null);
let amazonBrand = $ref<string | null>(null);

// URL情報の取得
const fetchUrlData = async () => {
  const requestLang = normalizedLang;

  // 状態の初期化
  failed = false;
  isSteam = false;
  isAmazon = false;
  steamAgeLimit = null;
  steamGameName = "";
  steamDeveloper = "";
  steamOnSale = false;
  steamDiscount = 0;
  steamOriginalPrice = null;
  steamCurrentPrice = null;
  steamGenres = "";
  steamComingSoon = false;
  steamReleaseDate = "";
  amazonPriceDisplay = null;
  amazonPriceValue = null;
  amazonPriceCurrency = null;
  amazonAvailability = null;
  amazonPrime = false;
  amazonRatingValue = null;
  amazonRatingCount = null;
  amazonBrand = null;
  tweetId = null;
  tweetExpanded = defaultStore.state.alwaysXExpand || props.detail;
  playerEnabled = false;
  player = normalizeUrlPreviewPlayer(null);
  showThumbnail = false;
  isSensitive = false;
  preferLargeThumbnail = false;

  try {
    // サーバと同じ正規化（music.youtube.com 等）。初回が {} だと以降の補正に届かないため fetch 前に行う。
    const previewFetchUrl = normalizeUrlForPreviewFetch(props.url);
    // `v` はサーバ未使用。Cache-Control 付き応答のブラウザキャッシュをビルド単位で分離する。
    const response = await fetch(
		`/url?url=${encodeURIComponent(previewFetchUrl)}&lang=${encodeURIComponent(requestLang)}&v=${encodeURIComponent(version)}`,
	  );
	  const info = await response.json();
	  if (info.url == null) {
	    // サーバ側で取得失敗（レートリミット・anti-bot・ネガティブキャッシュ等）。
	    // 空のカードを出さず、従来どおり何も表示しない。
	    failed = true;
	    fetching = false;
	    return;
	  }

	  // Steamの場合の処理
        if (info.steam) {
          isSteam = true;
          isSensitive = info.isSensitive ?? false;
          preferLargeThumbnail = info.preferLargeThumbnail ?? false;
          steamGameName = info.title;
          description = info.description;
          icon = info.icon;
          thumbnail = info.thumbnail;
          steamAgeLimit = info.steam.ageLimit;
          steamDeveloper = info.steam.developer;
          steamOnSale = info.steam.onSale;
          steamDiscount = info.steam.discountPercent;
          steamOriginalPrice = info.steam.originalPrice;
          steamCurrentPrice =
            info.steam.currentPrice ||
            (info.steam.isFree ? "無料プレイ" : "");
          steamGenres = info.steam.genres;
          steamComingSoon = !!info.steam.releaseDate?.comingSoon;
          steamReleaseDate = info.steam.releaseDate?.date ?? "";
        } else if (info.amazon) {
          isAmazon = true;
          isSensitive = info.isSensitive ?? false;
          preferLargeThumbnail = info.preferLargeThumbnail ?? false;
          title = info.title;
          description = info.description;
          thumbnail = info.thumbnail;
          icon = info.icon;
          sitename = info.sitename;
          player = normalizeUrlPreviewPlayer(info.player);
          amazonPriceValue = info.amazon.price?.value ?? null;
          amazonPriceCurrency = info.amazon.price?.currency ?? null;
          amazonPriceDisplay =
            info.amazon.price?.display ??
            (amazonPriceValue != null && amazonPriceCurrency
              ? formatCurrencyValue(amazonPriceValue, amazonPriceCurrency)
              : null);
          amazonAvailability = info.amazon.availability ?? null;
          amazonPrime = !!info.amazon.prime;
          amazonRatingValue = info.amazon.rating?.value ?? null;
          amazonRatingCount = info.amazon.rating?.count ?? null;
          amazonBrand = info.amazon.brand ?? null;
        } else {
          // 既存の処理（取得 URL は previewFetchUrl で正規化済みのため 2 重 fetch はしない）
          isSensitive = info.isSensitive ?? false;
          preferLargeThumbnail = info.preferLargeThumbnail ?? false;
          title = info.title;
          description = info.description;
          thumbnail = info.thumbnail;
		icon = info.icon;
		sitename = info.sitename;
		player = normalizeUrlPreviewPlayer(info.player);

		// X 投稿 ID（リンク先は props.url のまま）
		const requestUrl = new URL(props.url);
		if (!["http:", "https:"].includes(requestUrl.protocol))
		  throw new Error("invalid url");

		let tweet = "";

		if (
		  requestUrl.hostname === "twitter.com" ||
		  requestUrl.hostname === "mobile.twitter.com" ||
		  requestUrl.hostname === "x.com" ||
		  requestUrl.hostname === "mobile.x.com"
		) {
		  const m = requestUrl.pathname.match(/^\/.+\/status(?:es)?\/(\d+)/);
		  if (m) tweet = m[1];
		}

		if (title !== "X") {
		  tweetId = tweet.length > 0 ? tweet : null;
		}
	  }
	  fetching = false;
	} catch (error) {
	  console.error("URLデータの取得中にエラーが発生しました:", error);
	  failed = true;
	  fetching = false;
	}
  };

  // 初期化時にデータを取得
  fetchUrlData();

  function adjustTweetHeight(message: any) {
	if (message.origin !== "https://platform.twitter.com") return;
	const embed = message.data?.["twttr.embed"];
	if (embed?.method !== "twttr.private.resize") return;
	if (embed?.id !== embedId) return;
	const height = embed?.params[0]?.height;
	if (height) tweetHeight = height;
  }

  (window as any).addEventListener("message", adjustTweetHeight);

  onUnmounted(() => {
	(window as any).removeEventListener("message", adjustTweetHeight);
  });
  </script>

  <style lang="scss" scoped>
  .player {
	position: relative;
	width: 100%;

	> button {
	  position: absolute;
	  top: -1.5em;
	  right: 0;
	  font-size: 1em;
	  width: 1.5em;
	  height: 1.5em;
	  padding: 0;
	  margin: 0;
	  color: var(--fg);
	  background: rgba(128, 128, 128, 0.2);
	  opacity: 0.7;

	  &:hover {
		opacity: 0.9;
	  }
	}

	> iframe {
	  height: 100%;
	  left: 0;
	  position: absolute;
	  top: 0;
	  width: 100%;
	}
  }

  .mk-url-preview {
	&.max-width_400px {
	  > .link {
		font-size: 0.75rem;

		> .thumbnail {
		  /* height: 5rem; */
		}

		> article {
		  padding: 0.75rem;
		}
	  }
	}

	&.max-width_350px {
	  > .link {
		font-size: 0.625rem;

		> article {
		  padding: 0.5rem;

		  > header {
			margin-bottom: 0.25rem;
		  }

		  > footer {
			margin-top: 0.25rem;

			> img {
			  width: 0.75rem;
			  height: 0.75rem;
			}
		  }
		}

		&.compact {
		  > article {
			padding: 0.25rem;

			> header {
			  margin-bottom: 0.125rem;
			}

			> footer {
			  margin-top: 0.125rem;
			}
		  }
		}
	  }
	}

	> .expandTweet {
	  margin-top: 0.1875rem;
	}

	> .showThumbnail {
	  margin-top: 0.1875rem;
	}

	> .link {
	  position: relative;
	  display: block;
	  font-size: 0.875rem;
	  margin-top: 0.1875rem;
	  border: 0.0625rem solid var(--divider);
	  border-radius: 0.5rem;
	  overflow: hidden;
	  transition: background 0.2s;
	  pointer-events: none;
	  &:hover,
	  &:focus-within {
		text-decoration: none;
		background: var(--panelHighlight);
		> article > header > h1 {
		  text-decoration: underline;
		}
	  }

	  > .thumbnail {
		position: relative;
		width: 100%;
		height: 13em;
		background-position: center;
		background-size: contain;
		background-repeat: no-repeat;
		display: flex;
		justify-content: center;
		align-items: center;
		pointer-events: none;

		&.thumbnail-placeholder {
		  background: var(--panel);
		  color: var(--fg);
		  font-size: 0.9em;
		  opacity: 0.8;
		}

		> button {
		  font-size: 6em;
		  opacity: 0.9;
		  pointer-events: auto;

		  &:hover {
			font-size: 6em;
			opacity: 1;
		  }
		}

		& + article {
		  left: 0;
		  width: 100%;
		}
	  }

	  > article {
		position: relative;
		box-sizing: border-box;
		padding: 1rem;
		pointer-events: auto;

		> header {
		  margin-bottom: 0.5rem;

		  > h1 {
			margin: 0;
			font-size: 1em;
		  }
		}

		> p {
		  margin: 0;
		  font-size: 0.8em;
		}

		> footer {
		  margin-top: 0.5rem;
		  height: 1rem;

		  > img {
			display: inline-block;
			width: 1rem;
			height: 1rem;
			margin-right: 0.25rem;
			vertical-align: top;
		  }

		  > p {
			display: inline-block;
			margin: 0;
			color: var(--urlPreviewInfo);
			font-size: 0.8em;
			line-height: 1rem;
			vertical-align: top;
		  }
		}
	  }

	  &.compact {
		> article {
		  > header h1,
		  p,
		  footer {
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		  }
		}
	  }
	}

	&.legacyStyle {
	  &.max-width_350px {
		> .link {
		  > .thumbnail {
			height: 4.375rem;
		  }
		  &.compact:has(> .thumbnail) {
			> .thumbnail {
			  position: absolute;
			  width: 3.5rem;
			  height: 100%;
			}
			> article {
			  left: 3.5rem;
			  width: calc(100% - 3.5rem);
			}
		  }
		}
	  }

	  > .expandTweet {
		margin-top: 0;
	  }

	  > .showThumbnail {
		margin-top: 0;
	  }

	  > .link {
		margin-top: 0;
		pointer-events: auto;
		> .thumbnail {
		  position: absolute;
		  width: 6.25rem;
		  height: 100%;
		  background-size: cover;
		  pointer-events: auto;

		  > button {
			font-size: 3.5em;
			opacity: 0.7;

			&:hover {
			  font-size: 4em;
			  opacity: 0.9;
			}
		  }

		  & + article {
			left: 6.25rem;
			width: calc(100% - 6.25rem);
		  }
		}
	  }
	}
        &.steam {
          .link {
                pointer-events: none;
                display: flex;
                flex-direction: column;

		.thumbnail {
		  order: 1;
		  pointer-events: none;
		}

		article {
		  order: 2;
		  pointer-events: auto;

		  header {
			display: flex;
			flex-direction: column;
			align-items: flex-start;

			h1 {
			  display: flex;
			  align-items: center;
			  margin: 0;
			  font-size: 1em;
			  overflow: visible;
			  white-space: normal;
			  word-break: normal;
			  word-break: auto-phrase;

			  .favicon {
				width: 24px;
				height: 24px;
				margin-right: 0.5rem;
			  }
			}

			.developer-release {
			  font-size: 0.9em;
			  color: var(--fg);
			  overflow: hidden;
			  white-space: nowrap;
			  text-overflow: ellipsis;
			}
			.steam-genres {
				font-size: 0.9em;
				color: var(--fg);
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
		  }

		  p {
			overflow: visible;
			white-space: normal;
			word-break: normal;
			word-break: auto-phrase;
		  }

		  .steam-row.steam-pricing {
			display: flex;
			align-items: center;
			font-size: 0.9em;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;

			.steam-discount {
			  background-color: green;
			  color: white;
			  padding: 0 0.5rem;
			  border-radius: 0.25rem;
			  margin-right: 0.5rem;
			  font-weight: bold;
			}

			.steam-original-price {
			  text-decoration: line-through;
			  opacity: 0.6;
			  margin-right: 0.5rem;
			}

			.steam-current-price {
			  font-weight: bold;
			}
		  }
		}
          }
        }
        &.amazon {
          .link {
                pointer-events: none;
                display: flex;
                flex-direction: column;

                .thumbnail {
                  order: 1;
                  pointer-events: none;
                }

                article {
                  order: 2;
                  pointer-events: auto;

                  header {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;

                        h1 {
                          margin: 0;
                          font-size: 1em;
                          overflow: visible;
                          white-space: normal;
                          word-break: normal;
                          word-break: auto-phrase;
                        }

                        .amazon-brand {
                          margin-top: 0.25rem;
                          font-size: 0.9em;
                          color: var(--fg);
                          opacity: 0.8;
                        }
                  }

                  p {
                        overflow: visible;
                        white-space: normal;
                        word-break: normal;
                        word-break: auto-phrase;
                  }

                  .amazon-footer {
                        display: flex;
                        flex-direction: column;
                        gap: 0.35rem;
                        font-size: 0.9em;
                        // NOTE: 共通 footer ルールが height:1rem を当てているため、
                        //       Amazon 用の複数行構成では auto に戻して全行が見えるようにする。
                        height: auto;

                        .amazon-price-row {
                          display: flex;
                          align-items: center;
                          overflow: hidden;
                          white-space: nowrap;
                          text-overflow: ellipsis;
                          gap: 0.5rem;

                          .amazon-price {
                                // NOTE: テーマによって可読性が落ちないよう、固定色を使わず本文色に追従する。
                                font-weight: bold;
                          }

                          .amazon-prime-badge {
                                display: inline-flex;
                                align-items: center;
                                gap: 0.2rem;
                                padding: 0.1rem 0.35rem;
                                border-radius: 0.25rem;
                                font-size: 0.85em;
                                font-weight: 700;
                                background: linear-gradient(90deg, #00a8e1, #1f3b8f);
                                color: #fff;
                          }
                        }

                        .amazon-rating {
                          display: flex;
                          align-items: center;
                          gap: 0.25rem;

                          .amazon-star {
                                color: #ffa41c;
                                font-size: 1.1em;
                          }

                          .amazon-rating-value {
                                font-weight: 600;
                          }

                          .amazon-rating-count {
                                opacity: 0.8;
                          }
                        }

                        .amazon-availability {
                          color: var(--fg);
                          opacity: 0.85;
                        }
                        .amazon-site-info {
                          // NOTE: 通常 URL プレビューの footer と同じく
                          //       「ロゴ + サイト名」を末尾 1 行で表示する。
                          margin-top: 0.15rem;
                          height: 1rem;
                          display: block;

                          .amazon-site-icon {
                                display: inline-block;
                                width: 1rem;
                                height: 1rem;
                                margin-right: 0.25rem;
                                vertical-align: top;
                          }

                          .amazon-site-name {
                                display: inline-block;
                                margin: 0;
                                color: var(--urlPreviewInfo);
                                font-size: 0.8em;
                                line-height: 1rem;
                                vertical-align: top;
                          }
                        }
                  }
                }
          }
        }
  }
  </style>
