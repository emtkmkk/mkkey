/**
 * @packageDocumentation
 *
 * 非フォロワー（投稿者が閲覧者をフォローしていない）向けの誤爆防止と、
 * ツールバー上の空リプ／返信ボタンの表示条件を集約する。
 *
 * @remarks
 * - `strangerReplyMisclickGuard` がオフのときは誤爆防止を一切適用しない（既定）。
 * - `toolbarAirReply` と誤爆防止が両方オンのときだけ「空リプ優先で通常返信を隠す」。
 * - `user.isFollowed === false` のときのみ適用。`null` / `undefined` は未確定として扱わない。
 * - 上記が成り立つノートでは、外観の「引用を別ボタン」がオンでも実効的にオフにし、引用は RT メニューへ戻す。
 * - `alwaysReplyInNoteMenu` がオンのときは、ログイン中すべてのノートでツールバー返信を隠す（メニューから返信）。
 *
 * @public
 */
import type * as misskey from "calckey-js";
import { $i } from "@/account";
import { defaultStore } from "@/store";

/**
 * ツールバー空リプがノートの公開範囲的に利用できるか（MkNote フッターと同条件）。
 *
 * @param note - 対象ノート
 * @returns 空リプを出してよい公開範囲なら true
 *
 * @remarks
 * `specified` は基本的に不可。ローカル宛先の CC 付き `specified` のみ例外。
 *
 * @public
 */
export function toolbarAirReplyAppliesToNote(
	note: Pick<
		misskey.entities.Note,
		"visibility" | "ccUserIdsCount"
	> & {
		user?: Pick<misskey.entities.User, "host"> | null;
	},
): boolean {
	return (
		note.visibility !== "specified" ||
		(!note.user?.host && !!note.ccUserIdsCount)
	);
}

/**
 * 非フォロワー向け誤爆防止の対象ノートか（返信非表示・引用の別ボタン実効オフの共通条件）。
 *
 * @param note - 対象ノート（通常は `appearNote`）
 * @returns 誤爆防止レイアウトを適用するなら true
 *
 * @remarks
 * 返信を隠すか／引用を RT に戻すかは同じ判定に揃え、条件の食い違いを防ぐ。
 *
 * @public
 */
export function strangerMisclickGuardActiveForNote(
	note: misskey.entities.Note,
): boolean {
	if (!defaultStore.state.strangerReplyMisclickGuard) return false;
	if (!defaultStore.state.toolbarAirReply) return false;
	if (!$i || $i.id === note.userId) return false;
	if (!toolbarAirReplyAppliesToNote(note)) return false;
	if (note.user?.isFollowed !== false) return false;
	return true;
}

/**
 * ツールバーから通常の返信ボタンを隠すか。
 *
 * @param note - 対象ノート（`appearNote`）
 * @returns 隠すなら true
 *
 * @remarks
 * - 非フォロワー誤爆防止が対象のノート、または `alwaysReplyInNoteMenu` がオンのとき真。
 * - NOTE: メニューに返信を出す条件やキーボードショートカット抑止にも使う。
 *
 * @public
 */
export function hideToolbarNormalReply(note: misskey.entities.Note): boolean {
	if (!$i) return false;
	if (defaultStore.state.alwaysReplyInNoteMenu) return true;
	return strangerMisclickGuardActiveForNote(note);
}

/**
 * このノートで「引用を別ボタン」を実際に表示するか。
 *
 * @param note - 対象ノート
 * @returns 別ボタンを出すなら true（RT メニューから引用を除く）
 *
 * @remarks
 * 外観で `seperateRenoteQuote` がオンのとき、誤爆防止対象ノートでは一時的に false を返し引用を RT メニューへ戻す。
 *
 * @public
 */
export function effectiveSeparateRenoteQuoteForNote(
	note: misskey.entities.Note,
): boolean {
	if (!defaultStore.state.seperateRenoteQuote) return false;
	if (strangerMisclickGuardActiveForNote(note)) return false;
	return true;
}

/**
 * ツールバーに空リプボタンを表示するか（ログイン・本人投稿・設定を含む）。
 *
 * @param note - 対象ノート
 * @returns 表示するなら true
 *
 * @public
 */
export function showToolbarAirReplyForNote(note: misskey.entities.Note): boolean {
	if (!$i || !defaultStore.state.toolbarAirReply) return false;
	if ($i.id === note.userId) return false;
	return toolbarAirReplyAppliesToNote(note);
}
