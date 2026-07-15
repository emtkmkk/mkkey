/**
 * @packageDocumentation
 *
 * 要素がビューポートに入ったとき（false → true の交差）だけコールバックを実行するディレクティブ。
 *
 * @remarks
 * - 無限スクロール（`v-appear="fetchMore"`）向け。交差している間ずっと発火すると、
 *   読み込み完了後にボタンが再び交差した瞬間に連鎖 fetch が起き得るため、
 *   **未交差 → 交差への遷移時のみ** 呼び出す。
 * - binding が `null` になった場合は observer を停止する（エラー中など自動読込無効時）。
 *
 * @example
 * ```vue
 * <MkButton v-appear="enableInfiniteScroll ? fetchMore : null" @click="fetchMore">
 *   {{ i18n.ts.loadMore }}
 * </MkButton>
 * ```
 *
 * @public
 */
import type { Directive, DirectiveBinding } from "vue";

/** IntersectionObserver と前回交差状態を要素に紐づける拡張 */
type AppearElement = HTMLElement & {
	_observer_?: IntersectionObserver;
	_appearWasIntersecting_?: boolean;
	_appearFn_?: (() => void) | null;
};

/**
 * IntersectionObserver を開始する。
 *
 * @param el - 監視対象要素
 * @param fn - 交差 enter 時に呼ぶコールバック（null なら監視しない）
 *
 * @remarks
 * 既存 observer があれば破棄してから作り直す。
 *
 * @internal
 */
function startObserver(el: AppearElement, fn: (() => void) | null): void {
	stopObserver(el);
	el._appearFn_ = fn;
	if (fn == null) return;

	el._appearWasIntersecting_ = false;
	const observer = new IntersectionObserver((entries) => {
		const isIntersecting = entries.some((entry) => entry.isIntersecting);
		const callback = el._appearFn_;
		// 未交差 → 交差への遷移時のみ発火（連続交差中の重複呼び出しを防ぐ）
		if (
			isIntersecting &&
			!el._appearWasIntersecting_ &&
			typeof callback === "function"
		) {
			callback();
		}
		el._appearWasIntersecting_ = isIntersecting;
	});

	observer.observe(el);
	el._observer_ = observer;
}

/**
 * IntersectionObserver を停止して関連状態をクリアする。
 *
 * @param el - 対象要素
 *
 * @internal
 */
function stopObserver(el: AppearElement): void {
	if (el._observer_) {
		el._observer_.disconnect();
		delete el._observer_;
	}
	el._appearWasIntersecting_ = false;
	el._appearFn_ = null;
}

/**
 * `v-appear` ディレクティブ本体。
 *
 * @remarks
 * - `mounted`: 初回監視開始
 * - `updated`: binding 変更追従（null で停止、関数差し替えで再開）
 * - `unmounted`: 監視解除
 *
 * @public
 */
export default {
	mounted(src: AppearElement, binding: DirectiveBinding) {
		startObserver(src, binding.value ?? null);
	},

	updated(src: AppearElement, binding: DirectiveBinding) {
		const fn = binding.value ?? null;
		// 値が変わっていなければ何もしない（不要な observer 再生成を避ける）
		if (fn === src._appearFn_) return;
		startObserver(src, fn);
	},

	unmounted(src: AppearElement) {
		stopObserver(src);
	},
} as Directive;
