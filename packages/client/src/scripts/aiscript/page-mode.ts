/**
 * @packageDocumentation
 *
 * Pages のブロックモード / Play モード判定ヘルパー。
 *
 * @remarks
 * Play モードは `content` が空かつ `script` が非空のときに有効。
 *
 * @public
 */

/** ページモード判定に使う最小フィールド */
export type PageModeSource = {
	content?: unknown[] | null;
	script?: string | null;
};

/**
 * ページが Play モード（AiScript Ui: のみ）かどうかを判定する。
 *
 * @param page - content / script を持つページオブジェクト
 * @returns Play モードなら true
 * @public
 */
export function isPagePlayMode(page: PageModeSource): boolean {
	const content = page.content ?? [];
	const script = (page.script ?? "").trim();
	return script.length > 0 && content.length === 0;
}
