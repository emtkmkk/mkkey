/**
 * @packageDocumentation
 *
 * 返信時に親ノート本文からコピーされる追加メンションの有無を判定する純粋関数（コア）。
 *
 * @remarks
 * NOTE: punycode 等の環境依存を避けるため {@link noteWouldCopyExtraReplyMentions} は `toASCII` を引数で受け取る。
 *
 * @internal
 */
import * as mfm from "mfm-js";
import { extractMentions } from "./extract-mentions.ts";

/**
 * 返信メンション判定に使う閲覧者情報。
 *
 * @public
 */
export type ReplyMentionViewer = {
	username: string;
	host?: string | null;
};

/**
 * 返信メンション判定に使うノート情報。
 *
 * @public
 */
export type ReplyMentionNote = {
	text: string | null;
	user: {
		username: string;
		host?: string | null;
	};
};

/**
 * 親ノート本文から、著者メンション以外にコピーされるメンションがあるか。
 *
 * @param note - 返信先ノート
 * @param viewer - 返信するユーザー（未ログイン時は null）
 * @param localHost - 自インスタンスのホスト名
 * @param toASCII - ホスト名の punycode 変換
 * @returns 追加コピー対象のメンションが 1 件以上あれば true
 *
 * @public
 */
export function noteWouldCopyExtraReplyMentions(
	note: ReplyMentionNote,
	viewer: ReplyMentionViewer | null,
	localHost: string,
	toASCII: (value: string) => string,
): boolean {
	if (note.text == null) return false;

	let text = "";

	// 著者メンションを先頭に入れた状態を再現（本人への返信ではスキップ）
	if (
		viewer &&
		(note.user.username !== viewer.username ||
			(note.user.host != null && note.user.host !== localHost))
	) {
		text = `@${note.user.username}${
			note.user.host != null ? `@${toASCII(note.user.host)}` : ""
		} `;
	}

	const ast = mfm.parse(note.text);
	const otherHost = note.user.host;

	for (const x of extractMentions(ast)) {
		const mention = x.host
			? `@${x.username}@${toASCII(x.host)}`
			: otherHost == null || otherHost === localHost
				? `@${x.username}`
				: `@${x.username}@${toASCII(otherHost)}`;

		// 自分は除外
		if (
			viewer &&
			viewer.username === x.username &&
			(x.host == null || x.host === localHost)
		) {
			continue;
		}

		// 重複は除外（著者メンション等）
		if (text.includes(`${mention} `)) continue;

		return true;
	}

	return false;
}
