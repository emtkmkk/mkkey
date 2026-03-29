/**
 * @packageDocumentation
 *
 * パック済みノートの「リノート先が連合（リモート）か」の判定。
 *
 * @remarks
 * - **用途**: LTL の純リノート重複排除でローカル先のみデデュープする。
 * - **優先順**: ラッパーの `renoteUserHost`（DB 非正規化・常に信頼できる）→ `renote.user.host` → `renote.uri`。
 * - **背景**: ネスト `renote` の pack が `user` や `uri` を欠く経路があり、それだけだとリモートをローカル扱いして誤スキップしていた。
 *
 * @internal
 */
import type { Packed } from "@/misc/schema.js";

/**
 * リノート先をリモート（自インスタンス外の投稿者）として扱うか。
 *
 * @param note - パック済みノート（ラッパー）
 * @returns リモート先なら true
 *
 * @internal
 */
export function isRemoteRenoteTarget(note: Packed<"Note">): boolean {
	const denorm = note.renoteUserHost;
	if (typeof denorm === "string" && denorm.length > 0) {
		return true;
	}

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
