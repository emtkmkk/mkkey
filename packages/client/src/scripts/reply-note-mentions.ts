/**
 * @packageDocumentation
 *
 * 返信時に親ノート本文からコピーされる追加メンションの有無を判定する。
 *
 * @public
 */
import { toASCII } from "punycode/";
import {
	noteWouldCopyExtraReplyMentions as noteWouldCopyExtraReplyMentionsCore,
	type ReplyMentionNote,
	type ReplyMentionViewer,
} from "@/scripts/reply-note-mentions-core";

export type { ReplyMentionNote, ReplyMentionViewer };

/**
 * 親ノート本文から、著者メンション以外にコピーされるメンションがあるか。
 *
 * @param note - 返信先ノート
 * @param viewer - 返信するユーザー（未ログイン時は null）
 * @param localHost - 自インスタンスのホスト名
 * @returns 追加コピー対象のメンションが 1 件以上あれば true
 *
 * @public
 */
export function noteWouldCopyExtraReplyMentions(
	note: ReplyMentionNote,
	viewer: ReplyMentionViewer | null,
	localHost: string,
): boolean {
	return noteWouldCopyExtraReplyMentionsCore(
		note,
		viewer,
		localHost,
		toASCII,
	);
}
