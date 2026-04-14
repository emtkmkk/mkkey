/**
 * @packageDocumentation
 *
 * `/url`（Summaly）向けに、取得成功率が高い URL へ寄せる正規化。
 *
 * @see {@link urlPreviewHandler} Web の URL プレビュー
 * @internal
 */

/** YouTube Music ドメイン（プレビュー用に www へ寄せる対象） */
const MUSIC_YOUTUBE_HOST = "music.youtube.com";

/**
 * watch / channel / playlist のパスのみ www へ寄せる（それ以外の music 専用パスは触らない）。
 *
 * @remarks
 * NOTE: `/browse` 等はメイン YouTube と 1:1 で対応しないため対象外。
 */
const MUSIC_YOUTUBE_PREVIEW_PATH = /^\/(?:watch|channel|playlist)(?:\/|$)/i;

/**
 * URL プレビュー API へ渡す直前の URL を正規化する。
 *
 * @param urlString - ユーザー入力またはリダイレクト後の絶対 URL
 * @returns 正規化後の URL（失敗時は入力をそのまま返す）
 *
 * @remarks
 * - ハッシュは OGP 取得に不要なため除去する（従来クライアントの 2 回目 fetch と同趣旨）。
 */
export function normalizeUrlForPreviewFetch(urlString: string): string {
	try {
		const u = new URL(urlString);
		if (u.protocol !== "http:" && u.protocol !== "https:") {
			return urlString;
		}
		// フラグメント以降はサーバに送られないが、キャッシュキー・ログ用に揃える
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
