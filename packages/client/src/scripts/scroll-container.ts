/**
 * @packageDocumentation
 *
 * UI シェルごとのスクロールコンテナ API。
 * ルーターの位置保存/復元と scroll ユーティリティが参照する。
 *
 * @remarks
 * NOTE: deck UI では列ごとにスクロールコンテナが異なるため、
 * {@link registerDeckColumnScrollBody} で登録された main 列を優先する。
 *
 * @internal
 */

import type { InjectionKey } from "vue";
import { inject } from "vue";

/** スクロール位置の保存・復元に使う API */
export type ScrollContainerApi = {
	/** 現在のスクロール位置を返す */
	getScrollPosition: () => number;
	/** スクロール位置を設定する */
	setScrollPosition: (top: number, behavior?: ScrollBehavior) => void;
	/** 先頭へスクロールする */
	scrollToTop: (behavior?: ScrollBehavior) => void;
};

type ScrollBehavior = "auto" | "smooth" | "instant";

/** provide / inject 用キー */
export const scrollContainerKey: InjectionKey<ScrollContainerApi> =
	Symbol("scrollContainer");

/** deck 列のスクロール body（columnId → element） */
const deckColumnScrollBodies = new Map<string, HTMLElement>();

/** 列 body に付与した scroll リスナーの解除関数 */
const deckColumnScrollCleanups = new Map<string, () => void>();

/** スクロール操作通知の購読者 */
const scrollActivityListeners = new Set<() => void>();

/**
 * スクロール操作を通知する（deck 列内スクロール等）
 *
 * @internal
 */
export function notifyScrollActivity(): void {
	for (const listener of scrollActivityListeners) {
		listener();
	}
}

/**
 * スクロール操作通知を購読する
 *
 * @param cb - 通知時に呼ばれるコールバック
 * @returns 購読解除関数
 * @internal
 */
export function onScrollActivity(cb: () => void): () => void {
	scrollActivityListeners.add(cb);
	return () => scrollActivityListeners.delete(cb);
}

let activeScrollContainer: ScrollContainerApi = createWindowScrollContainer();

/**
 * モジュール全体で使うスクロールコンテナ API を取得する
 *
 * @returns 現在アクティブなスクロールコンテナ API
 * @internal
 */
export function getScrollContainerApi(): ScrollContainerApi {
	return activeScrollContainer;
}

/**
 * UI シェル起動時にスクロールコンテナ API を登録する
 *
 * @param api - シェルが提供する API
 * @internal
 */
export function setScrollContainerApi(api: ScrollContainerApi): void {
	activeScrollContainer = api;
}

/**
 * window をスクロールコンテナとする API を生成する
 *
 * @returns window ベースの API
 * @public
 */
export function createWindowScrollContainer(): ScrollContainerApi {
	return {
		getScrollPosition: () => window.scrollY,
		setScrollPosition: (top, behavior = "instant") => {
			window.scrollTo({ top, behavior });
		},
		scrollToTop: (behavior = "instant") => {
			window.scrollTo({ top: 0, behavior });
		},
	};
}

/**
 * 特定要素をスクロールコンテナとする API を生成する
 *
 * @param getEl - スクロール対象要素を返す関数
 * @returns 要素ベースの API
 * @public
 */
export function createElementScrollContainer(
	getEl: () => HTMLElement | null | undefined,
): ScrollContainerApi {
	return {
		getScrollPosition: () => getEl()?.scrollTop ?? 0,
		setScrollPosition: (top, behavior = "instant") => {
			const el = getEl();
			if (!el) return;
			el.scrollTo({ top, behavior });
		},
		scrollToTop: (behavior = "instant") => {
			const el = getEl();
			if (!el) return;
			el.scrollTo({ top: 0, behavior });
		},
	};
}

/**
 * deck 列のスクロール body を登録する
 *
 * @param columnId - 列 ID
 * @param el - スクロール body 要素
 * @param isMain - main 列かどうか
 * @internal
 */
export function registerDeckColumnScrollBody(
	columnId: string,
	el: HTMLElement,
	isMain: boolean,
): void {
	deckColumnScrollBodies.set(columnId, el);
	if (isMain) {
		deckMainColumnId = columnId;
	}

	// 列内スクロールもルーターの位置保存対象にする
	deckColumnScrollCleanups.get(columnId)?.();
	const onScroll = () => notifyScrollActivity();
	el.addEventListener("scroll", onScroll, { passive: true });
	deckColumnScrollCleanups.set(columnId, () => {
		el.removeEventListener("scroll", onScroll);
	});
}

/**
 * deck 列のスクロール body 登録を解除する
 *
 * @param columnId - 列 ID
 * @internal
 */
export function unregisterDeckColumnScrollBody(columnId: string): void {
	deckColumnScrollBodies.delete(columnId);
	deckColumnScrollCleanups.get(columnId)?.();
	deckColumnScrollCleanups.delete(columnId);
	if (deckMainColumnId === columnId) {
		deckMainColumnId = null;
	}
}

/** main 列の ID（未登録時は null） */
let deckMainColumnId: string | null = null;

/**
 * deck UI 用のスクロールコンテナ API を生成する
 *
 * @remarks
 * main 列の body を優先し、なければ最初に登録された列を使う。
 *
 * @returns deck 向け API
 * @public
 */
export function createDeckScrollContainer(): ScrollContainerApi {
	const resolveBody = (): HTMLElement | null => {
		if (deckMainColumnId) {
			const main = deckColumnScrollBodies.get(deckMainColumnId);
			if (main) return main;
		}
		return deckColumnScrollBodies.values().next().value ?? null;
	};
	return createElementScrollContainer(resolveBody);
}

/**
 * Vue コンポーネントからスクロールコンテナ API を取得する
 *
 * @returns inject された API、未設定時は window ベース
 * @public
 */
export function useScrollContainer(): ScrollContainerApi {
	return inject(scrollContainerKey, () => createWindowScrollContainer(), true);
}
