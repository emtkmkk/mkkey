/**
 * @packageDocumentation
 *
 * 投稿を表す短い要約文字列を組み立てる。
 *
 * @remarks
 * 添付件数は欠落ファイル（fileIds のみ残っている場合）も含める。
 *
 * @internal
 */
import * as misskey from "calckey-js";
import { i18n } from "@/i18n";
import {
	noteFileSlotCount,
	noteHasFileSlots,
} from "@/scripts/note-file-attachments";

/**
 * 投稿を表す文字列を取得します。
 *
 * @param note - pack 済み投稿
 * @returns 要約テキスト
 * @public
 */
export const getNoteSummary = (note: misskey.entities.Note): string => {
	if (note.deletedAt) {
		return `(${i18n.ts.deleted})`;
	}

	let summary = "";

	// 本文
	if (note.cw != null) {
		summary += `${note.cw} (CW${note.text ? ` 📝${note.text.length}` : ""})`;
	} else {
		summary += note.text ? note.text : "";
	}

	// ファイルが添付されているとき（欠落スロット含む）
	const fileCount = noteFileSlotCount(note);
	if (fileCount !== 0) {
		summary += ` (${i18n.t("withNFiles", { n: fileCount })})`;
	}

	// リノートである場合
	if (note.renoteId && !note.text && !noteHasFileSlots(note) && !note.poll) {
		summary += ` (RT)`;
	} else if (note.renoteId) {
		summary += ` (QT)`;
	}

	// 投票が添付されているとき
	if (note.poll) {
		summary += ` (${i18n.ts.poll})`;
	}

	return summary.trim();
};
