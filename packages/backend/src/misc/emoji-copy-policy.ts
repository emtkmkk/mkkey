/**
 * @packageDocumentation
 *
 * リモート絵文字を「このサーバーで使ってよいか（コピー・再配信してよいか）」の判定をまとめたモジュール。
 *
 * @remarks
 * - 絵文字一覧（emojis）、`/emoji/*.webp`、リアクションの送信、インポート申請・承認で同じ判定を使う。
 *   以前は禁止ホストの一覧が 6 か所に直接書かれていて、追加・削除のたびに全部を直す必要があった。
 * - 判定は「禁止ホストの絵文字」か「ライセンスでコピー拒否（copyPermission = deny）」のどちらか。
 * - IDEA: 禁止ホストは管理画面（meta）で設定できるようにすると、変更のたびにデプロイしなくて済む。
 *
 * @internal
 */
import { fromStoredCopyPermission } from "./copy-permission.js";

/**
 * 絵文字の利用（他サーバー絵文字としての一覧表示・インポート・リアクション送信）を断っているホスト。
 *
 * @remarks
 * 相手サーバーから「絵文字を使わないでほしい」と求められたホストを入れる。
 * 追加するとそのホストの絵文字は一覧・`/emoji/` から消え、リアクションは既定のリアクションに置き換えて送る。
 *
 * @internal
 */
export const EMOJI_COPY_DENIED_HOSTS: readonly string[] = [
	"voskey.icalo.net",
	"9ineverse.com",
	"mogeko.monster",
];

/**
 * 絵文字利用を断っているホストか
 *
 * @param host - 絵文字のホスト（ローカルは null）
 * @returns 禁止ホストなら true
 * @internal
 */
export function isEmojiCopyDeniedHost(host: string | null | undefined): boolean {
	return host != null && EMOJI_COPY_DENIED_HOSTS.includes(host);
}

/**
 * リモート絵文字を、このサーバーでコピー・再利用してはいけないか
 *
 * @remarks
 * ローカル絵文字（host が null）は常に false。ローカル絵文字の使用可否は usageVisibility で別に判定する。
 *
 * @param emoji - 絵文字（host と、DB に保存した形の copyPermission）
 * @returns 禁止ホストか、ライセンスでコピー拒否なら true
 * @internal
 */
export function isRemoteEmojiCopyDenied(emoji: {
	host?: string | null;
	copyPermission?: string | null;
}): boolean {
	if (emoji.host == null) return false;
	return (
		isEmojiCopyDeniedHost(emoji.host) ||
		fromStoredCopyPermission(emoji.copyPermission) === "deny"
	);
}
