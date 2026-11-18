/**
 * @packageDocumentation
 *
 * リモート投稿の参照フォルダ用セッションキャッシュ。
 *
 * @remarks
 * - 最近使用した100投稿分の参照一覧を再利用する（開閉連打対策）。
 * - 上限を超えて追い出された一覧は、次に開くとき再取得する。
 * - サーバ側 `NoteReferenceCache` とは別層。
 *
 * @public
 */
import * as misskey from "calckey-js";
import * as os from "@/os";
import { LimitedCache } from "@/scripts/limited-cache";

type PackedNote = misskey.entities.Note;

/** noteId → 取得成功した参照一覧 */
const sessionCache = new LimitedCache<string, PackedNote[]>(100);

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
			// キャッシュのクリア後に古い要求が完了しても、新しい寿命の状態へ戻さない。
			if (inflight.get(noteId) === promise) sessionCache.set(noteId, refs);
			return refs;
		})
		.finally(() => {
			if (inflight.get(noteId) === promise) inflight.delete(noteId);
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
