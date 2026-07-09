/**
 * @packageDocumentation
 *
 * 汎用 `Cache` のインメモリ件数上限定数。
 *
 * @remarks
 * - 用途ごとに `maxEntries` を一元管理し、各 `new Cache` 呼び出しで参照する。
 * - 値はプロセスローカル。マルチワーカー時はワーカーごとにこの上限が適用される。
 *
 * @internal
 */

/** キーが実質 1 件（`null` キー、nodeinfo 等） */
export const CACHE_MAX_SINGLETON = 8;

/** 応答キャッシュ（emoji / instance-info 等、キー少数） */
export const CACHE_MAX_SMALL = 256;

/** ホスト・インスタンス単位 */
export const CACHE_MAX_HOST = 2_000;

/** ユーザ ID 単位 */
export const CACHE_MAX_USER = 10_000;

/** `userId:noteId` 等高カーディナリティ */
export const CACHE_MAX_USER_NOTE = 20_000;

/** URL プレビュー系 */
export const CACHE_MAX_URL = 10_000;

/** リスト / グループ ID 単位 */
export const CACHE_MAX_LIST = 2_000;

/** 登録アプリ数程度 */
export const CACHE_MAX_APP = 1_000;
