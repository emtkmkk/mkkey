/**
 * @packageDocumentation
 *
 * 絵文字申請の通知を押したときに開くページのパスを決める。
 *
 * @remarks
 * 通知の返す形（pack）に入れて、ブラウザの通知一覧とプッシュ通知の両方が同じ場所を開けるようにする。
 * ページ側（`/emoji-requests/…` と `/admin/emoji-requests/…`）は、このパスの形に合わせて作る。
 *
 * @internal
 */

/** 申請の種類 */
export type EmojiRequestKind = "add" | "import" | "edit";

/** 通知の宛先 */
export type EmojiRequestRole = "requester" | "reviewer";

/**
 * 申請の詳細ページのパスを返す。
 *
 * @param kind - 申請の種類
 * @param id - 申請の ID
 * @param role - requester なら自分の申請の詳細、reviewer なら審査画面の詳細
 * @returns 同じサーバー内のパス（例 `/emoji-requests/add/xxxx`）
 * @internal
 */
export function getEmojiRequestPath(
	kind: EmojiRequestKind,
	id: string,
	role: EmojiRequestRole,
): string {
	const base = role === "reviewer" ? "/admin/emoji-requests" : "/emoji-requests";
	return `${base}/${kind}/${encodeURIComponent(id)}`;
}
