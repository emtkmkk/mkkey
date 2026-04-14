/**
 * @packageDocumentation
 *
 * `/url` 取得前に、プレビュー取得成功率が高い URL へ寄せる正規化。
 *
 * @public
 */

/** @internal YouTube Music ドメイン（プレビュー用に www へ寄せる対象） */
const MUSIC_YOUTUBE_HOST = "music.youtube.com";

/**
 * @internal watch / channel / playlist のパスのみ www へ寄せる。
 *
 * @remarks
 * NOTE: `/browse` 等はメイン YouTube と 1:1 で対応しないため対象外。
 */
const MUSIC_YOUTUBE_PREVIEW_PATH = /^\/(?:watch|channel|playlist)(?:\/|$)/i;

/**
 * `/url` クエリに載せる URL を正規化する。
 *
 * @param urlString - ノート等に貼られた絶対 URL
 * @returns 正規化後の URL（パース失敗時は入力をそのまま返す）
 */
export function normalizeUrlForPreviewFetch(urlString: string): string {
	try {
		const u = new URL(urlString);
		if (u.protocol !== "http:" && u.protocol !== "https:") {
			return urlString;
		}
		u.hash = "";
		if (
			u.hostname === MUSIC_YOUTUBE_HOST &&
			MUSIC_YOUTUBE_PREVIEW_PATH.test(u.pathname)
		) {
			u.hostname = "www.youtube.com";
		}
		return u.href;
	} catch {
		return urlString;
	}
}
