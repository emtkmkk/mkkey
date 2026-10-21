/**
 * @packageDocumentation
 *
 * 絵文字一覧の TypeORM クエリ結果キャッシュ（Redis）をまとめて無効化するヘルパ。
 *
 * @remarks
 * - 絵文字一覧は `meta`（{@link ../server/api/endpoints/meta}）と `emojis`（{@link ../server/api/endpoints/emojis}）が
 *   ID 付きのクエリキャッシュ（TTL 1 時間）で持っている。ID は並び順や範囲ごとに 4 つある。
 * - 以前は各所で `db.queryResultCache!.remove(["meta_emojis"])` と 1 つだけ消していたため、
 *   `createdAtDesc` 用の `meta_emojis2` とリモート込みの `meta_all_emojis` / `meta_all_emojis2` は
 *   絵文字を追加・更新・削除しても最大 1 時間古いまま残っていた。ここで全部消す。
 * - キャッシュが無効（`config.db.disableCache`）のときは何もしない（以前は `!` で落ちていた）。
 * - `emojis` 側の応答キャッシュ（in-memory 5 分）はここでは消えない。それは従来どおり。
 * @internal
 */
import { db } from "@/db/postgre.js";

/**
 * 絵文字一覧を保持しているクエリキャッシュの ID。
 *
 * @remarks
 * 追加・変更するときは `meta.ts` / `emojis.ts` の `cache.id` と合わせること。
 * @internal
 */
export const EMOJI_QUERY_CACHE_IDS = [
	// meta / emojis: ローカル絵文字（category, name 順）
	"meta_emojis",
	// emojis: ローカル絵文字（createdAt 降順）
	"meta_emojis2",
	// emojis: リモート絵文字（name 順）
	"meta_all_emojis",
	// emojis: 全絵文字（externalOutputAllEmojis 用、name 順）
	"meta_all_emojis2",
] as const;

/**
 * 絵文字一覧のクエリキャッシュをすべて無効化する。
 *
 * @remarks
 * 絵文字の追加・更新・削除・エイリアス変更・ライセンス変更など、一覧の内容が変わる操作の後に呼ぶ。
 * 集計用接続（`dbStats`）が書いたキャッシュも同じ Redis キー接頭辞なので、メイン接続から消せる。
 *
 * @returns Promise
 * @public
 */
export async function clearEmojiQueryCache(): Promise<void> {
	if (db.queryResultCache == null) return;
	await db.queryResultCache.remove([...EMOJI_QUERY_CACHE_IDS]);
}
