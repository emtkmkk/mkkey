/**
 * @packageDocumentation
 *
 * 絵文字の詳細のダイアログを開く。
 *
 * @remarks
 * もこきーの絵文字の情報の画面の URL（`/emoji_dialog/…`・`/emoji_license/…`）を押したとき、
 * ページを移動せずにこのダイアログで開く（投稿の中の「〇〇に移動」の枠、本文のリンクで共通）。
 * NB: `internal-link.ts` に置かないのは、あちらがルーターや os を読み込まない決まりのため（読み込みが循環してクライアントが起動しなくなる）。
 *
 * @internal
 */
import { defineAsyncComponent } from "vue";
import * as os from "@/os";
import { resolveInternalLink } from "@/scripts/internal-link";

/**
 * 絵文字の詳細のダイアログを開く。
 *
 * @param emoji - 絵文字の書き方（例「:yorosiku:」「:blobcat@misskey.io:」）
 * @internal
 */
export function openEmojiDialog(emoji: string): void {
	os.popup(
		defineAsyncComponent(() => import("@/components/MkCustomEmojiDetailedDialog.vue")),
		{ emoji },
		{},
		"closed",
	);
}

/**
 * URL が、もこきーの絵文字の情報の画面なら、その絵文字の書き方を返す。
 *
 * @param url - URL
 * @returns 絵文字の書き方（絵文字の情報の画面でなければ null）
 * @internal
 */
export function emojiOfInternalLink(url: string): string | null {
	const info = resolveInternalLink(url);
	return info?.kind === "emoji" ? info.emoji : null;
}
