/**
 * @packageDocumentation
 *
 * CSS の背景に使うリモート画像の URL を、読み込み失敗時に切り替える composable
 *
 * @remarks
 * `background-image` には読み込みの成否を知る手段がないので、別の `Image` で先に読んで確かめる。
 * 切り替えの順番は {@link getMediaFallbackUrls} と同じ。
 *
 * @internal
 */
import { ref, watch } from "vue";
import { getProxiedImageUrl } from "@/scripts/media-proxy";
import {
	getMediaFallbackUrls,
	loadImageWithFallback,
} from "@/scripts/media-proxy-fallback";

/**
 * リモート画像の表示用 URL を返す
 *
 * @remarks
 * 確認が終わるまでは元の URL を返す。すべて失敗したときも元の URL のままにする。
 *
 * @param sourceGetter - 元の画像 URL を返す関数
 * @param shouldTryProxy - 失敗時に別の URL を試すかどうかを返す関数（リモートユーザーの画像なら `true`）
 * @returns 表示に使う URL
 * @internal
 */
export function useRemoteImageWithProxy(
	sourceGetter: () => string | null | undefined,
	shouldTryProxy: () => boolean,
) {
	const resolvedUrl = ref<string | null>(null);
	// 確認中に元の URL が変わったとき、古い確認の結果で上書きしないための番号
	let requestId = 0;

	watch(
		sourceGetter,
		(url) => {
			const id = ++requestId;
			resolvedUrl.value = url ?? null;
			if (!url || typeof window === "undefined" || !shouldTryProxy()) return;

			const fallbacks = getMediaFallbackUrls(url);
			const urls = [
				url,
				// 外部プロキシの URL でなければ、このサーバの /proxy を通す
				...(fallbacks.length > 0 ? fallbacks : [getProxiedImageUrl(url)]),
			];
			void loadImageWithFallback(new Image(), urls).then((loadedUrl) => {
				if (id === requestId && loadedUrl) resolvedUrl.value = loadedUrl;
			});
		},
		{ immediate: true },
	);

	return resolvedUrl;
}
