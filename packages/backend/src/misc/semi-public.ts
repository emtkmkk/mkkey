/**
 * @packageDocumentation
 *
 * セミパブリック（ローカルではホーム、リモートには公開）と、リモートから見た公開範囲の判定。
 *
 * @remarks
 * - ノートの `visibility` はローカルでの公開範囲。連合に出すときの公開範囲は
 *   `localOnly` と `semiPublic` によって変わるので、その読み替えをここに集める。
 *   配送（`renderNote` / `renderAnnounce` の to / cc）と、リモートからの取得の可否
 *   （`server/activitypub.ts`）が同じ基準を使うことで、配送していない相手に返してしまう食い違いを防ぐ。
 * - セミパブリックを使えるユーザーの判定もここに置く。将来、権限を持つ一般ユーザーへ広げるときは
 *   {@link canUseSemiPublic} だけを直せばよい。
 *
 * @see {@link Note.semiPublic}
 * @internal
 */
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";

/**
 * リモートから見た公開範囲
 *
 * @remarks
 * `none` はリモートへ一切出さない投稿（チャンネルのローカル限定投稿、`hidden`）。
 *
 * @internal
 */
export type RemoteVisibility =
	| "public"
	| "home"
	| "followers"
	| "specified"
	| "none";

/**
 * バブル相手へ引き継ぐ、元のローカル公開範囲を返す。
 * @remarks NOTE: 通常リモート向けの宛先は変更せず、既存の _mk_localVisibility で違いだけを伝える。
 * @param note - 配送するローカルノート
 * @returns 元の public/home。読み替えが不要なら undefined
 * @internal
 */
export function getLocalVisibilityHint(note: Pick<Note, "visibility" | "localOnly" | "semiPublic">): "public" | "home" | undefined {
	if (note.localOnly && (note.visibility === "public" || note.visibility === "home")) return note.visibility;
	if (note.semiPublic && note.visibility === "home") return "home";
	return undefined;
}

/**
 * ユーザーがセミパブリックで投稿できるか
 *
 * @remarks
 * 現在は管理人とモデレーターのみ。
 * TODO: 一般ユーザーへ開放するときは、権限（ロール等）による判定に置き換える。
 * クライアント側の同名の判定（`packages/client/src/scripts/semi-public.ts`）も合わせて直すこと。
 *
 * @param user - 投稿するユーザー
 * @returns 使えるなら true
 * @internal
 */
export function canUseSemiPublic(
	user: Pick<User, "isAdmin" | "isModerator">,
): boolean {
	return user.isAdmin || user.isModerator;
}

/**
 * ローカルノートを連合に出すときの公開範囲を求める
 *
 * @remarks
 * - チャンネルの `localOnly` 投稿・`hidden` → `none`（配送しない）
 * - `localOnly` の public / home → `followers`（リモートにはフォロワー限定で配送する mkkey 独自の扱い）
 * - セミパブリック（`semiPublic` かつ home、`localOnly` でない）→ `public`
 * - それ以外 → `visibility` のまま
 *
 * NB: `semiPublic` が true でも `visibility` が home 以外・`localOnly` のときは公開にしない。
 * 作成時に落としているはずだが、万一の不整合でも広く出さない側に倒すため、ここでも確かめる。
 *
 * @param note - 判定するローカルノート
 * @returns リモートから見た公開範囲
 * @internal
 */
export function getRemoteVisibility(
	note: Pick<Note, "visibility" | "localOnly" | "channelId" | "semiPublic">,
): RemoteVisibility {
	if (note.localOnly && note.channelId) return "none";
	// hidden は作成時に連合しない扱い（create.ts の dontFederateInitially）
	if (note.visibility === "hidden") return "none";
	if (note.localOnly) {
		// フォロワー限定・ダイレクトはそのまま。public / home はリモートではフォロワー限定にする
		return note.visibility === "public" || note.visibility === "home"
			? "followers"
			: note.visibility;
	}
	if (note.semiPublic && note.visibility === "home") return "public";
	return note.visibility;
}
