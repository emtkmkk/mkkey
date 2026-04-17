/**
 * @packageDocumentation
 *
 * YouTube URL を oEmbed 対応 URL へ正規化し、種別を判定する。
 *
 * @remarks
 * NOTE: oEmbed 非対応の URL（channel / @handle / results 等）は null を返し、
 * 既存の Summaly 本流にフォールバックさせる。
 *
 * @internal
 */

/** oEmbed ルートで扱う YouTube コンテンツ種別 */
export type YouTubeKind = "video" | "shorts" | "playlist";

/**
 * oEmbed 呼び出しに必要な YouTube URL 情報。
 *
 * @public
 */
export type YouTubeOembedTarget = {
	/** oEmbed に渡す正規化済み URL */
	oembedUrl: string;
	/** 入力 URL 由来の種別（description 合成用） */
	kind: YouTubeKind;
	/** 表示用サイト名。music.youtube.com 起点だけ YouTube Music を返す */
	sitename: "YouTube" | "YouTube Music";
	/** 動画 ID（取得できないケースでは null） */
	videoId: string | null;
};

const MAIN_YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"music.youtube.com",
]);

/**
 * YouTube URL を oEmbed 対応 URL へ変換する。
 *
 * @param urlString - 判定対象 URL
 * @returns oEmbed 対応情報。対象外 URL は null
 *
 * @remarks
 * - `watch` / `shorts` / `embed` / `youtu.be` は `watch?v=` 形式へ揃える。
 * - `playlist` は `playlist?list=` を維持する。
 * - `channel` / `@handle` / `results` などは Summaly へ任せるため null を返す。
 *
 * @public
 */
export function isYouTubeOembedTargetUrl(urlString: string): YouTubeOembedTarget | null {
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(urlString);
	} catch {
		return null;
	}

	if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
		return null;
	}

	const hostname = parsedUrl.hostname.toLowerCase();
	const sitename: "YouTube" | "YouTube Music" =
		hostname === "music.youtube.com" ? "YouTube Music" : "YouTube";

	//#region youtu.be 形式
	if (hostname === "youtu.be") {
		const videoId = sanitizeToken(parsedUrl.pathname.split("/").filter(Boolean)[0]);
		if (!videoId) return null;
		return {
			oembedUrl: `https://www.youtube.com/watch?v=${videoId}`,
			kind: "video",
			sitename,
			videoId,
		};
	}
	//#endregion

	//#region youtube-nocookie 埋め込み形式
	if (hostname === "www.youtube-nocookie.com" || hostname === "youtube-nocookie.com") {
		const segments = parsedUrl.pathname.split("/").filter(Boolean);
		if (segments[0]?.toLowerCase() !== "embed") return null;
		const videoId = sanitizeToken(segments[1]);
		if (!videoId) return null;
		return {
			oembedUrl: `https://www.youtube.com/watch?v=${videoId}`,
			kind: "video",
			sitename,
			videoId,
		};
	}
	//#endregion

	if (!MAIN_YOUTUBE_HOSTS.has(hostname)) {
		return null;
	}

	const path = parsedUrl.pathname.toLowerCase();
	const segments = parsedUrl.pathname.split("/").filter(Boolean);

	//#region watch URL
	if (path === "/watch") {
		const videoId = sanitizeToken(parsedUrl.searchParams.get("v"));
		if (!videoId) return null;
		return {
			oembedUrl: `https://www.youtube.com/watch?v=${videoId}`,
			kind: "video",
			sitename,
			videoId,
		};
	}
	//#endregion

	//#region shorts URL
	if (segments[0]?.toLowerCase() === "shorts") {
		const videoId = sanitizeToken(segments[1]);
		if (!videoId) return null;
		return {
			oembedUrl: `https://www.youtube.com/watch?v=${videoId}`,
			kind: "shorts",
			sitename,
			videoId,
		};
	}
	//#endregion

	//#region embed URL
	if (segments[0]?.toLowerCase() === "embed") {
		const videoId = sanitizeToken(segments[1]);
		if (!videoId) return null;
		return {
			oembedUrl: `https://www.youtube.com/watch?v=${videoId}`,
			kind: "video",
			sitename,
			videoId,
		};
	}
	//#endregion

	//#region playlist URL
	if (path === "/playlist") {
		const listId = sanitizeToken(parsedUrl.searchParams.get("list"));
		if (!listId) return null;
		return {
			oembedUrl: `https://www.youtube.com/playlist?list=${listId}`,
			kind: "playlist",
			sitename,
			videoId: null,
		};
	}
	//#endregion

	return null;
}

function sanitizeToken(value: string | null | undefined): string | null {
	if (!value) return null;
	const token = value.trim();
	if (token.length === 0) return null;
	return token;
}
