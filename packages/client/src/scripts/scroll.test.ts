/**
 * scroll.ts のユニットテスト
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
	getScrollContainer,
	isBottomVisible,
	isTopVisible,
} from "./scroll.ts";

test("isBottomVisible: コンテナ基準で最下部を判定する", () => {
	const container = {
		scrollHeight: 300,
		clientHeight: 100,
		scrollTop: 200,
	} as HTMLElement;
	const content = {} as HTMLElement;

	assert.equal(isBottomVisible(content, 1, container), true);

	container.scrollTop = 0;
	assert.equal(isBottomVisible(content, 1, container), false);
});

test("isTopVisible: scrollTop が tolerance 以下なら true", () => {
	const el = {
		tagName: "DIV",
		scrollHeight: 100,
		clientHeight: 100,
		scrollTop: 0,
		parentElement: null,
	} as HTMLElement;

	const originalGetComputedStyle = globalThis.window?.getComputedStyle?.bind(
		globalThis.window,
	);
	if (globalThis.window) {
		globalThis.window.getComputedStyle = (() =>
			({
				getPropertyValue: () => "auto",
			}) as CSSStyleDeclaration) as typeof globalThis.window.getComputedStyle;
	}

	assert.equal(isTopVisible(el), true);
	el.scrollTop = 50;
	assert.equal(isTopVisible(el), false);

	if (globalThis.window && originalGetComputedStyle) {
		globalThis.window.getComputedStyle = originalGetComputedStyle;
	}
});

test("getScrollContainer: overflow-y auto かつ実スクロール可能な要素を返す", () => {
	const scrollable = {
		tagName: "DIV",
		scrollHeight: 300,
		clientHeight: 100,
		parentElement: null,
	} as HTMLElement;

	const target = {
		tagName: "SPAN",
		parentElement: scrollable,
	} as HTMLElement;

	const originalGetComputedStyle = window.getComputedStyle.bind(window);
	window.getComputedStyle = ((el: Element) => {
		if (el === scrollable) {
			return { getPropertyValue: () => "auto" } as CSSStyleDeclaration;
		}
		return originalGetComputedStyle(el);
	}) as typeof window.getComputedStyle;

	assert.equal(getScrollContainer(target), scrollable);

	window.getComputedStyle = originalGetComputedStyle;
});

test("getScrollContainer: scrollHeight <= clientHeight の auto はスキップする", () => {
	const notScrollable = {
		tagName: "DIV",
		scrollHeight: 50,
		clientHeight: 100,
		parentElement: null,
	} as HTMLElement;

	const target = {
		tagName: "SPAN",
		parentElement: notScrollable,
	} as HTMLElement;

	const originalGetComputedStyle = window.getComputedStyle.bind(window);
	window.getComputedStyle = ((el: Element) => {
		if (el === notScrollable) {
			return { getPropertyValue: () => "auto" } as CSSStyleDeclaration;
		}
		return originalGetComputedStyle(el);
	}) as typeof window.getComputedStyle;

	assert.equal(getScrollContainer(target), null);

	window.getComputedStyle = originalGetComputedStyle;
});
