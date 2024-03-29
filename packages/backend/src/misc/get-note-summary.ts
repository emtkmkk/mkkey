import type { Packed } from "./schema.js";

/**
 * 投稿を表す文字列を取得します。
 * @param {*} note (packされた)投稿
 */
export const getNoteSummary = (note: Packed<"Note">): string => {
	if (note.deletedAt) {
		return "🗑️";
	}

	let summary = "";

	// 本文
	if (note.cw != null) {
		summary += `${note.cw} (CW${note.text ? ` 📝${note.text.length}` : ""})`;
	} else {
		summary += note.text ? note.text : "";
	}

	// ファイルが添付されているとき
	if ((note.files || []).length !== 0) {
		summary += ` (📎${note.files!.length})`;
	}

	// リノートである場合
	if (note.renoteId && !note.text && !note.files && !note.poll) {
		summary += ` (RT)`;
	} else if (note.renoteId) {
		summary += ` (QT)`;
	}

	// 投票が添付されているとき
	if (note.poll) {
		summary += " (📊)";
	}

	/*
	// 返信のとき
	if (note.replyId) {
		if (note.reply) {
			summary += `\n\nRE: ${getNoteSummary(note.reply)}`;
		} else {
			summary += '\n\nRE: ...';
		}
	}

	// Renoteのとき
	if (note.renoteId) {
		if (note.renote) {
			summary += `\n\nRN: ${getNoteSummary(note.renote)}`;
		} else {
			summary += '\n\nRN: ...';
		}
	}
	*/

	return summary.trim();
};
