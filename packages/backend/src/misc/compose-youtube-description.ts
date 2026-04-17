/**
 * @packageDocumentation
 *
 * YouTube oEmbed 応答から URL プレビュー用 description を組み立てる。
 *
 * @remarks
 * NOTE: 動画（video）だけは種別ラベルを付けず、作者名のみを表示する。
 *
 * @internal
 */
import type { YouTubeKind } from "@/misc/is-youtube-oembed-target-url.js";

/**
 * oEmbed 情報から description 表示文字列を生成する。
 *
 * @param authorName - oEmbed の `author_name`
 * @param oembedType - oEmbed の `type`（video / playlist / rich など）
 * @param kind - 入力 URL 由来の種別
 * @returns description に入れる文字列。作者名が無い場合は null
 *
 * @public
 */
export function composeYouTubeDescription(
	authorName: string | null | undefined,
	oembedType: string | null | undefined,
	kind: YouTubeKind,
): string | null {
	if (!authorName) return null;

	const normalizedAuthorName = authorName.trim();
	if (normalizedAuthorName.length === 0) return null;

	// NOTE: 入力 URL 由来の kind を優先し、動画のときだけ作者名のみ表示する。
	if (kind === "video") {
		return normalizedAuthorName;
	}

	const label = resolveTypeLabel(kind, oembedType);
	if (!label) return normalizedAuthorName;

	return `${label}: ${normalizedAuthorName}`;
}

function resolveTypeLabel(kind: YouTubeKind, oembedType: string | null | undefined): string | null {
	if (kind === "shorts") return "Shorts";
	if (kind === "playlist") return "プレイリスト";

	if (!oembedType) return null;
	const normalizedType = oembedType.trim().toLowerCase();
	if (!normalizedType || normalizedType === "video") return null;
	if (normalizedType === "playlist") return "プレイリスト";

	return normalizedType.slice(0, 1).toUpperCase() + normalizedType.slice(1);
}
