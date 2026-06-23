/**
 * @packageDocumentation
 *
 * ユーザー登録のカスタム CSS スニペットの取得・保存・DOM 反映。
 *
 * @remarks
 * - 有効なスニペットのみ `data-mk-css-snippet` 付き style タグとして注入する。
 * - 旧 `localStorage.customCss` は初回取得時に1件のスニペットへ移行する。
 *
 * @public
 */
import { v4 as uuid } from "uuid";
import { ColdDeviceStorage, type CssSnippet } from "@/store";
import { i18n } from "@/i18n";

export type { CssSnippet } from "@/store";

/** DOM 上の style タグを識別する属性名 */
export const CSS_SNIPPET_STYLE_ATTR = "data-mk-css-snippet";

/** レガシー単一 CSS の localStorage キー */
const LEGACY_CUSTOM_CSS_KEY = "customCss";

/** boot.js がレガシー CSS 注入に使う DOM マーカー */
const LEGACY_STYLE_ATTR = "data-mk-css-snippet-legacy";

let legacyMigrationDone = false;

//#region ストレージ

/**
 * スニペット一覧を取得する（初回はレガシー CSS を移行する）。
 *
 * @returns 登録済みスニペット配列
 * @public
 */
export function getCssSnippets(): CssSnippet[] {
	migrateLegacyCustomCssIfNeeded();
	return ColdDeviceStorage.get("cssSnippets");
}

/**
 * スニペット一覧を保存する。
 *
 * @param snippets - 保存する配列
 * @public
 */
export function saveCssSnippets(snippets: CssSnippet[]): void {
	ColdDeviceStorage.set("cssSnippets", snippets);
}

/**
 * ID でスニペットを取得する。
 *
 * @param id - スニペット ID
 * @returns 見つかったスニペット、なければ undefined
 * @public
 */
export function getCssSnippetById(id: string): CssSnippet | undefined {
	return getCssSnippets().find((s) => s.id === id);
}

/**
 * スニペット1件を更新する。
 *
 * @param id - 対象 ID
 * @param patch - 上書きするフィールド
 * @returns 更新後のスニペット。存在しなければ undefined
 * @public
 */
export function updateCssSnippet(
	id: string,
	patch: Partial<Omit<CssSnippet, "id">>,
): CssSnippet | undefined {
	const snippets = getCssSnippets();
	const index = snippets.findIndex((s) => s.id === id);
	if (index < 0) return undefined;

	const updated: CssSnippet = { ...snippets[index], ...patch };
	snippets[index] = updated;
	saveCssSnippets(snippets);
	return updated;
}

//#endregion

//#region レガシー移行

/**
 * 旧 `customCss` を1件のスニペットとして取り込む。
 *
 * @remarks
 * `miux:cssSnippets` が空で、かつ `customCss` に内容がある場合のみ実行する。
 *
 * @public
 */
export function migrateLegacyCustomCssIfNeeded(): void {
	if (legacyMigrationDone) return;
	legacyMigrationDone = true;

	const snippets = ColdDeviceStorage.get("cssSnippets");
	if (snippets.length > 0) return;

	const legacyCss = localStorage.getItem(LEGACY_CUSTOM_CSS_KEY);
	if (!legacyCss?.trim()) return;

	const migrated: CssSnippet = {
		id: uuid(),
		name: i18n.ts._cssSnippet.migratedName,
		description: i18n.ts._cssSnippet.migratedDescription,
		css: legacyCss,
		active: true,
	};

	saveCssSnippets([migrated]);
	localStorage.removeItem(LEGACY_CUSTOM_CSS_KEY);

	// boot.js が注入したレガシー style を除去し、移行後の二重注入を防ぐ
	for (const el of document.querySelectorAll(`style[${LEGACY_STYLE_ATTR}]`)) {
		el.remove();
	}
}

//#endregion

//#region CRUD

/**
 * 新規スニペットを作成する。
 *
 * @param input - 名前・説明・CSS・有効状態
 * @returns 作成されたスニペット
 * @public
 */
export function createCssSnippet(input: {
	name: string;
	description?: string;
	css?: string;
	active?: boolean;
}): CssSnippet {
	const snippet: CssSnippet = {
		id: uuid(),
		name: input.name.trim(),
		description: input.description?.trim() || undefined,
		css: input.css ?? "",
		active: input.active ?? true,
	};

	saveCssSnippets(getCssSnippets().concat(snippet));

	if (snippet.active && snippet.css.trim()) {
		applySnippetToDom(snippet);
	}

	return snippet;
}

/**
 * スニペットを削除する。
 *
 * @param id - 削除対象 ID
 * @public
 */
export function deleteCssSnippet(id: string): void {
	removeSnippetFromDom(id);
	saveCssSnippets(getCssSnippets().filter((s) => s.id !== id));
}

/**
 * 有効/無効を切り替える（ページ再読み込みなしで DOM に反映）。
 *
 * @param id - 対象 ID
 * @param active - 有効にするか
 * @returns 更新後のスニペット。存在しなければ undefined
 * @public
 */
export function changeCssSnippetActive(
	id: string,
	active: boolean,
): CssSnippet | undefined {
	const updated = updateCssSnippet(id, { active });
	if (!updated) return undefined;

	if (active) {
		applySnippetToDom(updated);
	} else {
		removeSnippetFromDom(id);
	}

	return updated;
}

//#endregion

//#region DOM 反映

/**
 * 指定 ID の style タグを DOM から除去する。
 *
 * @param id - スニペット ID
 * @public
 */
export function removeSnippetFromDom(id: string): void {
	for (const el of document.querySelectorAll(
		`style[${CSS_SNIPPET_STYLE_ATTR}="${id}"]`,
	)) {
		el.remove();
	}
}

/**
 * スニペットを DOM に反映する（既存タグは置き換え）。
 *
 * @param snippet - 反映対象
 * @public
 */
export function applySnippetToDom(snippet: CssSnippet): void {
	removeSnippetFromDom(snippet.id);
	if (!snippet.active || !snippet.css.trim()) return;

	const el = document.createElement("style");
	el.setAttribute(CSS_SNIPPET_STYLE_ATTR, snippet.id);
	el.textContent = snippet.css;
	document.head.appendChild(el);
}

/**
 * 有効なスニペットをすべて DOM に反映する。
 *
 * @remarks
 * boot.js で既に注入済みのタグはスキップし、二重注入を防ぐ。
 *
 * @public
 */
export function applyCssSnippets(): void {
	for (const snippet of getCssSnippets()) {
		if (!snippet.active || !snippet.css.trim()) {
			removeSnippetFromDom(snippet.id);
			continue;
		}

		const exists = document.querySelector(
			`style[${CSS_SNIPPET_STYLE_ATTR}="${snippet.id}"]`,
		);
		if (!exists) {
			applySnippetToDom(snippet);
		}
	}
}

//#endregion
