/**
 * @packageDocumentation
 *
 * 非フォロワー（投稿者が閲覧者をフォローしていない）向けの誤爆防止と、
 * ツールバー上の空リプ／返信ボタンの表示条件を集約する。
 *
 * @remarks
 * - `strangerReplyMisclickGuard` がオフのときは誤爆防止を一切適用しない（既定）。
 * - 返信・空リプは `strangerMisclickGuardActiveForNote`（公開範囲は `toolbarAirReplyAppliesToNote` に従う）。
 * - RT／引用の分離は `strangerMisclickSuppressesSeparateRenoteQuoteForNote` でのみ抑制し、
 *   投稿者が閲覧者をフォローしていない（`user.isFollowed === false`）他人ノートに限定する（公開範囲ゲートは使わない）。
 * - 公開範囲が `specified`（UI 上のダイレクト）のノートは誤爆防止の対象外とする。
 * - `user.isFollowed === false` の解釈は返信側も同じ。`null` / `undefined` は厳密等価で誤爆対象にしない。
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
 * 非フォロワー向け誤爆防止の対象ノートか（返信非表示・ツールバー空リプ表示の共通条件）。
 *
 * @param note - 対象ノート（通常は `appearNote`）
 * @returns 誤爆防止レイアウトを適用するなら true
 *
 * @remarks
 * - `toolbarAirReply` とは無関係。返信を隠すか／空リプを出すかはこの判定に揃える。
 * - 引用の RT／分離は {@link strangerMisclickSuppressesSeparateRenoteQuoteForNote} を使う（公開範囲ゲートを掛けない）。
 * - `visibility === 'specified'`（ダイレクト相当）は対象外。
 *
 * @public
 */
export function strangerMisclickGuardActiveForNote(
	note: misskey.entities.Note,
): boolean {
	if (!defaultStore.state.strangerReplyMisclickGuard) return false;
	// ダイレクト（specified）では誤爆防止を掛けない（DM 的な文脈での操作をそのままにする）。
	if (note.visibility === "specified") return false;
	if (!$i || $i.id === note.userId) return false;
	if (!toolbarAirReplyAppliesToNote(note)) return false;
	if (note.user?.isFollowed !== false) return false;
	return true;
}

/**
 * 非フォロワー誤爆防止により「引用を別ボタン」を実効オフにするか。
 *
 * @param note - 対象ノート（通常は `appearNote`）
 * @returns 分離を抑止し引用を RT メニューへ寄せるなら true
 *
 * @remarks
 * - 投稿者が閲覧者をフォローしていない（`user.isFollowed === false`）ときのみ真。未確定（undefined 等）は偽。
 * - 本人のノートは対象外。`note.user` が無いときは偽（分離を維持）。
 * - `visibility === 'specified'`（ダイレクト相当）は対象外。
 * - `toolbarAirReplyAppliesToNote` は使わない（返信用の公開範囲ゲートと引用 UI を切り離す）。
 *
 * @public
 */
export function strangerMisclickSuppressesSeparateRenoteQuoteForNote(
	note: misskey.entities.Note,
): boolean {
	if (!defaultStore.state.strangerReplyMisclickGuard) return false;
	// ダイレクト（specified）では引用分離の抑制もしない。
	if (note.visibility === "specified") return false;
	if (!$i || note.userId === $i.id) return false;
	if (!note.user) return false;
	return note.user.isFollowed === false;
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
 * 外観で `seperateRenoteQuote` がオンのとき、{@link strangerMisclickSuppressesSeparateRenoteQuoteForNote} が真なら一時的に false を返し引用を RT メニューへ戻す。
 *
 * @public
 */
export function effectiveSeparateRenoteQuoteForNote(
	note: misskey.entities.Note,
): boolean {
	if (!defaultStore.state.seperateRenoteQuote) return false;
	if (strangerMisclickSuppressesSeparateRenoteQuoteForNote(note)) return false;
	return true;
}

/**
 * ツールバーに空リプボタンを表示するか（ログイン・本人投稿・設定を含む）。
 *
 * @param note - 対象ノート
 * @returns 表示するなら true
 *
 * @remarks
 * - `toolbarAirReply` がオンのとき常時表示。
 * - 誤爆防止が対象のノートでは `toolbarAirReply` なしでも表示し、返信非表示時の位置ズレを防ぐ。
 *
 * @public
 */
export function showToolbarAirReplyForNote(note: misskey.entities.Note): boolean {
	if (!$i || $i.id === note.userId) return false;
	if (!toolbarAirReplyAppliesToNote(note)) return false;
	if (defaultStore.state.toolbarAirReply) return true;
	return strangerMisclickGuardActiveForNote(note);
}
