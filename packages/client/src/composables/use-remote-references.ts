/**
 * @packageDocumentation
 *
 * リモート投稿の参照フォルダ用セッションキャッシュ。
 *
 * @remarks
 * - 一度読み込んだ参照一覧はページリロードまで再取得しない（開閉連打対策）。
 * - サーバ側 `NoteReferenceCache` とは別層。
 *
 * @public
 */
import * as misskey from "calckey-js";
import * as os from "@/os";

type PackedNote = misskey.entities.Note;

/** noteId → 取得成功した参照一覧 */
const sessionCache = new Map<string, PackedNote[]>();

/** 進行中の取得（同一 noteId の重複リクエスト抑止） */
const inflight = new Map<string, Promise<PackedNote[]>>();

/**
 * リモート親投稿の参照一覧を取得する（セッションキャッシュ付き）
 *
 * @param noteId - 親投稿 ID
 * @returns 参照先ノートの pack 一覧
 * @public
 */
export async function fetchRemoteReferences(
	noteId: string,
): Promise<PackedNote[]> {
	const cached = sessionCache.get(noteId);
	if (cached) return cached;

	const pending = inflight.get(noteId);
	if (pending) return pending;

	const promise = os.api("notes/references", { noteId })
		.then((refs: PackedNote[]) => {
			sessionCache.set(noteId, refs);
			return refs;
		})
		.finally(() => {
			inflight.delete(noteId);
		});

	inflight.set(noteId, promise);
	return promise;
}

/**
 * セッションキャッシュをクリアする（テスト用）
 *
 * @internal
 */
export function clearRemoteReferencesSessionCache(): void {
	sessionCache.clear();
	inflight.clear();
}
