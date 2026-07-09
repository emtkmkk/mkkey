/**
 * @packageDocumentation
 *
 * スクロール位置の取得・判定・移動ユーティリティ。
 *
 * @remarks
 * NOTE: 底判定はコンテナ基準（scrollHeight - scrollTop - clientHeight）で統一している。
 *
 * @public
 */

type ScrollBehavior = "auto" | "smooth" | "instant";

/** overflow-y でスクロール可能とみなす値 */
const SCROLLABLE_OVERFLOW_Y = new Set(["scroll", "auto", "overlay"]);

// Scroll Behaviorのポリフィルを追加
const smoothScrollSupported =
	"scrollBehavior" in document.documentElement.style;

/**
 * 要素が縦方向に実際にスクロール可能かどうか
 *
 * @param el - 判定対象要素
 * @returns スクロール可能なら true
 * @internal
 */
function isVerticallyScrollable(el: HTMLElement): boolean {
	const overflow = window.getComputedStyle(el).getPropertyValue("overflow-y");
	return SCROLLABLE_OVERFLOW_Y.has(overflow) && el.scrollHeight > el.clientHeight;
}

/**
 * 要素から最も近いスクロール可能な祖先を返す
 *
 * @param el - 起点要素
 * @returns スクロールコンテナ。window スクロールの場合は null
 * @public
 */
export function getScrollContainer(el: HTMLElement | null): HTMLElement | null {
	if (!el || el.tagName === "HTML") return null;
	if (isVerticallyScrollable(el)) {
		return el;
	}
	if (el.parentElement instanceof HTMLElement) {
		return getScrollContainer(el.parentElement);
	}
	return null;
}

/**
 * document のスクロール要素を返す
 *
 * @returns scrollingElement
 * @internal
 */
function getScrollingElement(): Element {
	return document.scrollingElement ?? document.documentElement;
}

/**
 * 不正なスクロール対象を開発ビルドで警告する
 *
 * @param fn - 呼び出し元関数名
 * @param el - 対象要素
 * @internal
 */
function warnInvalidScrollTarget(fn: string, el: unknown): void {
	if (import.meta.env.DEV && (el == null || !(el instanceof HTMLElement))) {
		console.warn(`[scroll] ${fn}: invalid element`, el);
	}
}

/**
 * 要素基準の現在スクロール位置を返す
 *
 * @param el - 起点要素
 * @returns scrollTop または window.scrollY
 * @public
 */
export function getScrollPosition(el: HTMLElement | null): number {
	const container = getScrollContainer(el);
	return container == null ? window.scrollY : container.scrollTop;
}

/**
 * 先頭付近までスクロールしているかどうか
 *
 * @param el - 起点要素
 * @param tolerance - 許容誤差（px）
 * @returns 先頭付近なら true
 * @public
 */
export function isTopVisible(el: HTMLElement | null, tolerance = 1): boolean {
	const scrollTop = getScrollPosition(el);
	return scrollTop <= tolerance;
}

/**
 * 最下部付近までスクロールしているかどうか
 *
 * @param el - 起点要素（互換性のため受け取るが判定はコンテナ基準）
 * @param tolerance - 許容誤差（px）
 * @param container - スクロールコンテナ（省略時は el から探索）
 * @returns 最下部付近なら true
 * @public
 */
export function isBottomVisible(
	el: HTMLElement | null,
	tolerance = 1,
	container: HTMLElement | null = el ? getScrollContainer(el) : null,
): boolean {
	if (!el) return false;
	if (container) {
		return (
			container.scrollHeight - container.scrollTop - container.clientHeight <=
			tolerance
		);
	}
	const scrollingEl = getScrollingElement();
	return (
		scrollingEl.scrollHeight - window.scrollY - window.innerHeight <= tolerance
	);
}

/**
 * 先頭到達時にコールバックを呼ぶ
 *
 * @param el - 起点要素
 * @param cb - 先頭到達時のコールバック
 * @param tolerance - 許容誤差（px）
 * @param once - 一度だけ呼ぶか
 * @returns リスナー解除関数
 * @public
 */
export function onScrollTop(
	el: HTMLElement,
	cb: () => void,
	tolerance = 1,
	once = false,
) {
	if (!el.isConnected || !document.body.contains(el)) return;

	if (isTopVisible(el)) {
		cb();
		if (once) return;
	}

	const container = getScrollContainer(el) ?? window;

	const onScroll = () => {
		if (!document.body.contains(el)) return;
		if (isTopVisible(el, tolerance)) {
			cb();
			if (once) removeListener();
		}
	};

	function removeListener() {
		container.removeEventListener("scroll", onScroll);
	}
	container.addEventListener("scroll", onScroll, { passive: true });
	return removeListener;
}

/**
 * 最下部到達時にコールバックを呼ぶ
 *
 * @param el - 起点要素
 * @param cb - 最下部到達時のコールバック
 * @param tolerance - 許容誤差（px）
 * @param once - 一度だけ呼ぶか
 * @returns リスナー解除関数
 * @public
 */
export function onScrollBottom(
	el: HTMLElement,
	cb: () => void,
	tolerance = 1,
	once = false,
) {
	const container = getScrollContainer(el);

	if (!el.isConnected || !document.body.contains(el)) return;

	if (isBottomVisible(el, tolerance, container)) {
		cb();
		if (once) return;
	}

	const containerOrWindow = container ?? window;
	const onScroll = () => {
		if (!document.body.contains(el)) return;
		if (isBottomVisible(el, tolerance, container)) {
			cb();
			if (once) removeListener();
		}
	};

	function removeListener() {
		containerOrWindow.removeEventListener("scroll", onScroll);
	}
	containerOrWindow.addEventListener("scroll", onScroll, { passive: true });
	return removeListener;
}

/**
 * sticky ヘッダーの高さを加算する
 *
 * @param el - 起点要素
 * @param container - スクロールコンテナ
 * @param top - 累積オフセット
 * @returns sticky 分を加算したオフセット
 * @public
 */
export function getStickyTop(
	el: HTMLElement,
	container: HTMLElement | null = null,
	top = 0,
): number {
	if (!el.parentElement) return top;
	const data = el.dataset.stickyContainerHeaderHeight;
	const newTop = data ? Number(data) + top : top;
	if (el === container) return newTop;
	return getStickyTop(el.parentElement, container, newTop);
}

/**
 * 要素基準で sticky ヘッダー分の上端オフセットを取得する
 *
 * @param el - 起点要素
 * @param container - スクロールコンテナ
 * @returns sticky オフセット（px）
 * @public
 */
export function getStickyOffset(
	el: HTMLElement,
	container: HTMLElement | null = getScrollContainer(el),
): number {
	return getStickyTop(el, container);
}

/**
 * 要素または window を任意位置へスクロールする
 *
 * @param el - 起点要素
 * @param options - scrollTo オプション
 * @public
 */
export function scroll(el: HTMLElement, options?: ScrollToOptions | null) {
	const container = getScrollContainer(el);
	if (container == null) {
		if (smoothScrollSupported && options?.behavior) {
			window.scroll({ ...options });
		} else {
			window.scrollTo(options?.left ?? 0, options?.top ?? 0);
		}
	} else {
		if (smoothScrollSupported && options?.behavior) {
			container.scroll({ ...options });
		} else {
			container.scrollTo(options?.left ?? 0, options?.top ?? 0);
		}
	}
}

/**
 * 先頭へスクロールする
 *
 * @param el - 起点要素
 * @param options - behavior 等
 * @public
 */
export function scrollToTop(
	el: HTMLElement | null,
	options: { behavior?: ScrollBehavior } = {},
) {
	if (!el) {
		warnInvalidScrollTarget("scrollToTop", el);
		return;
	}
	const container = getScrollContainer(el);
	const stickyOffset = getStickyOffset(el, container);
	// NOTE: 先頭移動時は sticky ヘッダー分だけ下げた位置を先頭とみなす
	scroll(el, { top: Math.max(0, stickyOffset), ...options });
}

/**
 * 最下部へスクロールする
 *
 * @param el - 起点要素
 * @param options - scrollTo オプション
 * @param container - スクロールコンテナ（省略時は el から探索）
 * @public
 */
export function scrollToBottom(
	el: HTMLElement | null,
	options: ScrollToOptions = {},
	container: HTMLElement | null = el ? getScrollContainer(el) : null,
) {
	if (!el || !el.scrollHeight) {
		warnInvalidScrollTarget("scrollToBottom", el);
		return;
	}
	const topPosition = container
		? container.scrollHeight -
		  container.clientHeight +
		  getStickyTop(el, container)
		: getScrollingElement().scrollHeight -
		  window.innerHeight +
		  getStickyTop(el, null);
	if (container) {
		if (smoothScrollSupported && options.behavior) {
			container.scroll({ top: topPosition, ...options });
		} else {
			container.scrollTo(0, topPosition);
		}
	} else {
		if (smoothScrollSupported && options.behavior) {
			window.scroll({ top: topPosition, ...options });
		} else {
			window.scrollTo(0, topPosition);
		}
	}
}

/**
 * 要素を sticky ヘッダー下端に揃えるようにスクロールする
 *
 * @param el - 表示対象要素
 * @param options - behavior 等
 * @public
 */
export function scrollElementIntoViewWithStickyTop(
	el: HTMLElement | null,
	options: { behavior?: ScrollBehavior } = {},
): void {
	if (!el) {
		warnInvalidScrollTarget("scrollElementIntoViewWithStickyTop", el);
		return;
	}

	const container = getScrollContainer(el);
	const stickyOffset = getStickyOffset(el, container);
	const rect = el.getBoundingClientRect();

	if (container) {
		const containerRect = container.getBoundingClientRect();
		const top = container.scrollTop + (rect.top - containerRect.top) - stickyOffset;
		if (smoothScrollSupported && options.behavior) {
			container.scroll({ top, behavior: options.behavior });
		} else {
			container.scrollTo(0, top);
		}
		return;
	}

	const top = window.scrollY + rect.top - stickyOffset;
	if (smoothScrollSupported && options.behavior) {
		window.scroll({ top, behavior: options.behavior });
	} else {
		window.scrollTo(0, top);
	}
}

/**
 * 最下部付近までスクロールしているかどうか（{@link isBottomVisible} のエイリアス）
 *
 * @param el - 起点要素
 * @param tolerance - 許容誤差（px）
 * @returns 最下部付近なら true
 * @public
 */
export function isBottom(el: HTMLElement, tolerance = 0): boolean {
	return isBottomVisible(el, tolerance);
}

// https://ja.javascript.info/size-and-scroll-window#ref-932
/**
 * body / documentElement の最大スクロール高さを返す
 *
 * @returns スクロール高さ（px）
 * @public
 */
export function getBodyScrollHeight(): number {
	return Math.max(
		document.body.scrollHeight,
		document.documentElement.scrollHeight,
		document.body.offsetHeight,
		document.documentElement.offsetHeight,
		document.body.clientHeight,
		document.documentElement.clientHeight,
	);
}
