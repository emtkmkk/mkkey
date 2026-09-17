/**
 * @packageDocumentation
 *
 * 自ホスト宛メンションとして扱わない名前を判定する。
 *
 * @remarks
 * - **役割**: YouTube のチャンネルハンドル `@youtube` が `@youtube@{自ホスト}` へのメンションとして
 *   描画・自動挿入されるのを防ぐ（サーバ側は misc/is-ignored-mention と対）。
 * - リモート宛（`@youtube@example.com`）は通常のメンションとして扱う。
 * - NOTE: 純粋関数に保つため自ホスト名は引数で受け取る。
 *
 * @internal
 */

/** メンション扱いしないローカルユーザー名 */
const IGNORED_LOCAL_USERNAME = "youtube";

/**
 * 自ホスト宛のメンションとして無視すべきか判定する。
 *
 * @param username - メンションのユーザー名
 * @param host - メンションの実効ホスト。null/undefined はローカル扱い
 * @param localHost - 自インスタンスのホスト名
 * @returns 無視すべきなら true
 *
 * @public
 */
export function isIgnoredMention(
	username: string,
	host: string | null | undefined,
	localHost: string,
): boolean {
	if (host != null && host.toLowerCase() !== localHost.toLowerCase()) {
		return false;
	}

	return username.toLowerCase() === IGNORED_LOCAL_USERNAME;
}
