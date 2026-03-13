/**
 * @packageDocumentation
 *
 * DB に保存する文字列長の上限定数。DB_* を変更する場合は DB スキーマの変更も必要。
 *
 * @remarks
 * - **役割**: ノート本文・画像説明等の DB 制約を定め、const やバリデーションで参照される。
 *
 * @see {@link const} アプリ側定数
 * @internal
 */

/** DB に保存可能なノート本文の最大長（サロゲートペアは 1 文字として数える） */
export const DB_MAX_NOTE_TEXT_LENGTH = 8192;

/** DB に保存可能な画像説明の最大長（サロゲートペアは 1 文字として数える） */
export const DB_MAX_IMAGE_COMMENT_LENGTH = 8192;
