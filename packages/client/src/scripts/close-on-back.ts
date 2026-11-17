/**
 * @packageDocumentation
 *
 * 全画面の表示（画像ビューアなど）を、ブラウザやスマホの「戻る」操作で閉じられるようにするヘルパー。
 *
 * @remarks
 * 開いたときに同じ URL の履歴を 1 つ積み、`popstate`（戻る）が来たら閉じる。
 * ×ボタンなどふつうの方法で閉じたときは、積んだ履歴を自分で 1 つ戻して、余分な履歴を残さない。
 *
 * 積む履歴には、今の `history.state`（ルーターが付けたページの `key`）をそのまま引き継ぐ。
 * こうしておくと、戻ったときにルーター（`router.ts` の popstate 処理）が同じページ・同じ key と判断し、
 * ページを移動せず、スクロール位置もそのままになる（絵文字申請ページの画面切り替えと同じ考え方）。
 *
 * NOTE: 戻るで閉じたあと「進む」を押すと、積んだ履歴に進むが、表示は開き直さない（同じページのまま）。
 *
 * @public
 */
import type PhotoSwipeLightbox from "photoswipe/lightbox";

/** 積んだ履歴に入れる目印のキー名（`history.state` の中で使う。ほかの用途と重ならない名前にする） */
const STATE_KEY = "closeOnBack";

/**
 * 「戻る」で閉じられるように履歴を 1 つ積む。
 *
 * @remarks
 * - 戻る操作が来たら、登録を外してから `onBack` を 1 回だけ呼ぶ。
 * - 返した関数（release）は、ふつうの方法で閉じたときに呼ぶ。
 *   まだ積んだ履歴の上に居れば `history.back()` で取り除く。戻る操作で閉じた後に呼んでも何もしない。
 * - release は何回呼んでもよい。
 *
 * @param onBack - 戻る操作が来たときに表示を閉じる処理
 * @returns 登録を外し、積んだ履歴を取り除く関数
 *
 * @example
 * ```ts
 * const release = pushCloseOnBack(() => viewer.close());
 * viewer.on("close", release);
 * ```
 *
 * @public
 */
export function pushCloseOnBack(onBack: () => void): () => void {
	// 同時に複数積まれても取り違えないよう、1 回ごとに別の目印を付ける
	const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	window.history.pushState(
		{ ...(window.history.state ?? {}), [STATE_KEY]: token },
		"",
		location.href,
	);

	let active = true;

	/**
	 * 戻る操作で、積んだ履歴から離れたら閉じる。
	 *
	 * @param ev - popstate
	 */
	const onPopState = (ev: PopStateEvent): void => {
		// まだ自分の履歴の上に居る（ほかの何かが積んで戻った等）なら閉じない
		if (ev.state?.[STATE_KEY] === token) return;
		if (!active) return;
		active = false;
		window.removeEventListener("popstate", onPopState);
		onBack();
	};
	window.addEventListener("popstate", onPopState);

	return () => {
		if (!active) return;
		active = false;
		window.removeEventListener("popstate", onPopState);
		// 自分が積んだ履歴の上に居るときだけ戻す（別の場所へ移った後に戻してしまわないように）
		if (window.history.state?.[STATE_KEY] === token) window.history.back();
	};
}

/**
 * PhotoSwipe の lightbox を、開くたびに「戻る」で閉じられるようにする。
 *
 * @remarks
 * - `beforeOpen` で履歴を積み、`close` で取り除く（{@link pushCloseOnBack}）。
 * - PhotoSwipe は ×ボタン・背景クリック・Esc・下スワイプ・`destroy()` のどれで閉じても `close` を出すので、
 *   閉じ方ごとに書き分けなくてよい。
 * - `lightbox.init()` の前に呼ぶ。lightbox の `on` は、開くたびに作られる PhotoSwipe 本体にも引き継がれる。
 *
 * @param lightbox - 対象の lightbox
 * @public
 */
export function bindLightboxCloseOnBack(lightbox: PhotoSwipeLightbox): void {
	let release: (() => void) | null = null;
	lightbox.on("beforeOpen", () => {
		const pswp = lightbox.pswp;
		release?.();
		release = pushCloseOnBack(() => pswp?.close());
	});
	lightbox.on("close", () => {
		release?.();
		release = null;
	});
}
