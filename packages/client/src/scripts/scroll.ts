type ScrollBehavior = "auto" | "smooth" | "instant";

// Scroll Behaviorのポリフィルを追加
const smoothScrollSupported = 'scrollBehavior' in document.documentElement.style;

export function getScrollContainer(el: HTMLElement | null): HTMLElement | null {
	if (!el || el.tagName === "HTML") return null;
	const overflow = window.getComputedStyle(el).getPropertyValue("overflow-y");
	if (overflow === "scroll" || overflow === "auto") {
		return el;
	}
		if (el.parentElement instanceof HTMLElement) {
			return getScrollContainer(el.parentElement);
		}
			return null;
}
export function getScrollPosition(el: HTMLElement | null): number {
	const container = getScrollContainer(el);
	return container == null ? window.scrollY : container.scrollTop;
}

export function isTopVisible(el: HTMLElement | null, tolerance = 1): boolean {
	const scrollTop = getScrollPosition(el);
	return scrollTop <= tolerance;
}

export function isBottomVisible(
	el: HTMLElement,
	tolerance = 1,
	container: HTMLElement | null = getScrollContainer(el),
): boolean {
	if (!el || !el.scrollHeight) return false;
	if (container) {
		return (
			el.scrollHeight <=
			container.clientHeight + Math.abs(container.scrollTop) + tolerance
		);
	}
	return el.scrollHeight <= window.innerHeight + window.scrollY + tolerance;
}

export function onScrollTop(el: HTMLElement, cb: () => void, tolerance = 1, once = false) {
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

export function scrollToTop(
	el: HTMLElement,
	options: { behavior?: ScrollBehavior } = {},
) {
	scroll(el, { top: 0, ...options });
}

export function scrollToBottom(
	el: HTMLElement,
	options: ScrollToOptions = {},
	container: HTMLElement | null = getScrollContainer(el),
) {
	if (!el || !el.scrollHeight) return;
	const topPosition = el.scrollHeight - (container ? container.clientHeight : window.innerHeight) + getStickyTop(el, container);
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

export function isBottom(el: HTMLElement, asobi = 0): boolean {
	const container = getScrollContainer(el);
	const current = container
		? container.scrollTop + container.clientHeight
		: window.scrollY + window.innerHeight;
	const max = container ? el.scrollHeight : document.body.scrollHeight;
	return current >= max - asobi;
}

// https://ja.javascript.info/size-and-scroll-window#ref-932
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
