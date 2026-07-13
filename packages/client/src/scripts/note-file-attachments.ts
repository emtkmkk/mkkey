/**
 * @packageDocumentation
 *
 * ノートの添付ファイル ID（fileIds）と実体（files）の差分を扱うヘルパー。
 *
 * @remarks
 * ドライブからファイルを削除しても note.fileIds は残るため、
 * files に無い ID を「欠落添付」として扱う。
 *
 * @internal
 */
import type * as misskey from "calckey-js";

/**
 * ノートに添付スロットがあるか（実体・欠落の両方を含む）。
 *
 * @param note - pack 済みノート
 * @returns fileIds または files に要素があるとき true
 * @internal
 */
export function noteHasFileSlots(note: {
	fileIds?: string[] | null;
	files?: misskey.entities.DriveFile[] | null;
}): boolean {
	if (note.fileIds != null && note.fileIds.length > 0) return true;
	return (note.files?.length ?? 0) > 0;
}

/**
 * CW 等に表示する添付件数（欠落含む）。
 *
 * @param note - pack 済みノート
 * @returns fileIds があればその長さ、なければ files の長さ
 * @internal
 */
export function noteFileSlotCount(note: {
	fileIds?: string[] | null;
	files?: misskey.entities.DriveFile[] | null;
}): number {
	if (note.fileIds != null && note.fileIds.length > 0) {
		return note.fileIds.length;
	}
	return note.files?.length ?? 0;
}

/**
 * メディア一覧の1スロット（実ファイルまたは欠落）。
 *
 * @remarks
 * MkMediaList が fileIds 順に並べるために使う。
 *
 * @public
 */
export type NoteMediaSlot =
	| { kind: "file"; file: misskey.entities.DriveFile }
	| { kind: "missing"; id: string };

/**
 * fileIds 順のメディアスロットを組み立てる。
 *
 * @param fileIds - ノートの fileIds（省略時は files の順）
 * @param files - 実在する DriveFile 一覧
 * @returns fileIds 順のスロット配列
 * @internal
 */
export function buildNoteMediaSlots(
	fileIds: string[] | null | undefined,
	files: misskey.entities.DriveFile[] | null | undefined,
): NoteMediaSlot[] {
	const existing = files ?? [];
	if (fileIds == null || fileIds.length === 0) {
		return existing.map((file) => ({ kind: "file" as const, file }));
	}

	const byId = new Map(existing.map((file) => [file.id, file]));
	return fileIds.map((id) => {
		const file = byId.get(id);
		return file != null
			? { kind: "file" as const, file }
			: { kind: "missing" as const, id };
	});
}
