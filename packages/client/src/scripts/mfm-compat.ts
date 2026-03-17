/**
 * @file mfm-compat.ts
 * @packageDocumentation
 *
 * MFM（Misskey Flavored Markdown）の Misskey 互換表示モード判定を行うユーティリティ。
 * `$[position]` を含み、かつ nocompat オプションのない投稿で互換モードを有効にする判定に使用する。
 *
 * @remarks
 * - 互換モード有効時は投稿全体に Misskey 互換の CSS（絵文字 height/vertical-align, line-height）が適用される。
 * - `$[position nocompat]` のように nocompat が付いた position のみの場合は互換モードは有効にしない。
 *
 * @public
 */

import * as mfm from "mfm-js";

/**
 * MFM AST を再帰的に走査し、互換モードを有効にすべきかどうかを判定する。
 *
 * @param nodes - mfm.parse() で得たルートノード配列
 * @returns いずれかのノードが type === 'fn' かつ name が 'position'（大文字小文字無視）かつ args.nocompat が無い場合に true
 *
 * @remarks
 * - fn ノードの args は mfm-js のパース結果に依存する。nocompat は省略可能なオプション。
 * - 子孫ノード（入れ子の fn など）も再帰的に走査する。
 * - パーサやクライアント差で name の大文字小文字が異なる場合に備え、name は大文字小文字を区別しない。
 *
 * @internal
 */
function hasPositionWithoutNocompat(nodes: mfm.MfmNode[]): boolean {
	for (const node of nodes) {
		if (node.type === "fn" && node.props.name?.toLowerCase() === "position") {
			const args = node.props.args ?? {};
			const nocompat = args.nocompat;
			// nocompat が未指定または偽なら、この position は互換モードを有効にする
			if (!nocompat || nocompat === "false" || nocompat === "0") {
				return true;
			}
		}
		// 子ノードを再帰的に走査
		const children = "children" in node && Array.isArray(node.children) ? node.children : [];
		if (children.length > 0 && hasPositionWithoutNocompat(children as mfm.MfmNode[])) {
			return true;
		}
	}
	return false;
}

/**
 * ノート本文テキストから、Misskey 互換 MFM モードを有効にすべきかどうかを判定する。
 *
 * @param text - ノートの MFM 本文（プレーンテキスト）
 * @returns `$[position]` が含まれ、かつ nocompat を付けていない position が 1 つでもあれば true
 *
 * @remarks
 * - 空文字や null の場合は false を返す。
 * - パースに失敗した場合は false を返す（安全側に倒す）。
 *
 * @public
 */
export function shouldEnableMfmCompat(text: string | null | undefined): boolean {
	if (text == null || text === "") return false;
	try {
		const nodes = mfm.parse(text);
		return hasPositionWithoutNocompat(nodes);
	} catch {
		return false;
	}
}
