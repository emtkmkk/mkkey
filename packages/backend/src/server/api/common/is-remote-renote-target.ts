/**
 * @packageDocumentation
 *
 * パック済みノートの「リノート先が連合由来（リモート側）か」のざっくり判定。
 *
 * @remarks
 * - **用途**: LTL 等の純リノート重複排除で、ローカル先とそれ以外を区別する。
 * - **前提**: `renote.user` が無い pack でも、連合で取り込んだノートは `uri` を持つことが多いのでそれで補う。
 * - **注意**: 自インスタンスの投稿でも `uri` が常に付く運用だと、常にリモート扱いになり重複排除が弱まる。差分を抑えるため意図的に簡略化している。
 *
 * @internal
 */
import type { Packed } from "@/misc/schema.js";

/**
 * リノート先を「リモート（連合）先」として扱うか。
 *
 * @param note - パック済みノート
 * @returns `renote.user.host` がある、または `renote.uri` が非空なら true
 *
 * @internal
 */
export function isRemoteRenoteTarget(note: Packed<"Note">): boolean {
	const r = note.renote;
	if (r == null || typeof r !== "object") {
		return false;
	}

	const u = r.user;
	if (u != null && typeof u === "object" && u.host != null && u.host.length > 0) {
		return true;
	}

	return typeof r.uri === "string" && r.uri.length > 0;
}
