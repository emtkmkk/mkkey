/**
 * @packageDocumentation
 *
 * セミパブリック（ローカルではホーム、リモートには公開）の利用可否と、空リプの初期公開範囲。
 *
 * @remarks
 * - セミパブリックは、投稿 API に `visibility: "home"` と `semiPublic: true` を渡して指定する。
 *   公開範囲ピッカーからは選べず、投稿ボタンの種別（`s-home`）と空リプからだけ使う。
 * - 使えるのは現在は管理人とモデレーターのみ。サーバー側の `misc/semi-public.ts` の
 *   `canUseSemiPublic` と同じ条件にしておくこと（ずれると投稿時に 403 になる）。
 *
 * @public
 */
import * as misskey from "calckey-js";
import { $i } from "@/account";

/**
 * 投稿ボタンの種別設定でセミパブリックを表す値
 *
 * @remarks
 * 既存の `l-public` / `l-home`（ローカル＆フォロワー）と同じく、接頭辞付きの文字列で表す。
 *
 * @public
 */
export const SEMI_PUBLIC_SETTING_VALUE = "s-home";

/**
 * セミパブリックを表すアイコンのクラス
 *
 * @remarks
 * 投稿フォーム・投稿ボタン・ノートの公開範囲表示で同じものを使う。
 *
 * @public
 */
export const SEMI_PUBLIC_ICON = "ph-globe-hemisphere-west ph-bold ph-lg";

/**
 * ログイン中のユーザーがセミパブリックで投稿できるか
 *
 * @remarks
 * TODO: 一般ユーザーへ開放するときは、サーバーと合わせて権限による判定に置き換える。
 *
 * @returns 使えるなら true
 * @public
 */
export function canUseSemiPublic(): boolean {
	return $i != null && ($i.isAdmin || $i.isModerator);
}

/**
 * 空リプを書くときの投稿フォームの初期公開範囲を求める
 *
 * @remarks
 * - リモートの公開投稿への空リプは、ローカルの公開タイムラインに流さないためホームにする。
 *   セミパブリックを使えるユーザーなら、リモートには公開で届くようセミパブリックにする。
 * - それ以外は元の投稿の公開範囲に合わせる。
 * - ローカル限定は、元の投稿がローカル限定のときだけ ON（ローカル相手の公開ノートでは既定に合わせる）。
 *
 * @param note - 空リプの対象の投稿
 * @returns 投稿フォーム（`os.post`）に渡す初期値
 * @public
 */
export function getAirReplyInitialVisibility(note: misskey.entities.Note): {
	initialVisibility: misskey.entities.Note["visibility"];
	initialLocalOnly: boolean;
	initialSemiPublic: boolean;
} {
	const isRemotePublic = note.user.host != null && note.visibility === "public";
	return {
		initialVisibility: isRemotePublic ? "home" : note.visibility,
		initialLocalOnly: note.localOnly === true,
		initialSemiPublic: isRemotePublic && note.localOnly !== true && canUseSemiPublic(),
	};
}
