/**
 * @packageDocumentation
 *
 * DB に保存する文字列長の上限定数。DB_* を変更する場合は DB スキーマの変更も必要。
 *
 * @remarks
 * - **役割**: ノート本文・画像説明等の DB 制約を定め、const やバリデーションで参照される。
 * - **投票（連合）**: 選択肢を長くすると ActivityPub の Question ペイロードが肥大し、他実装が受け取れない可能性がある。`APP_MAX_POLL_CHOICE_LENGTH` は API・UI の契約、`DB_MAX_POLL_CHOICE_LENGTH` は DB・連合受信の物理上限に近い。
 *
 * @see {@link const} アプリ側定数
 * @internal
 */

/** DB に保存可能なノート本文の最大長（サロゲートペアは 1 文字として数える） */
export const DB_MAX_NOTE_TEXT_LENGTH = 8192;

/** DB に保存可能な画像説明の最大長（サロゲートペアは 1 文字として数える） */
export const DB_MAX_IMAGE_COMMENT_LENGTH = 8192;

/**
 * DB の `poll.choices` 各要素の最大長（Unicode コードポイント単位で数える想定でサービス層が検証）。
 *
 * @remarks
 * `Poll` エンティティの `varchar(256)` と一致させること。
 *
 * @see {@link APP_MAX_POLL_CHOICE_LENGTH} API・クライアントが許す短い上限
 */
export const DB_MAX_POLL_CHOICE_LENGTH = 256;

/**
 * 投票の各選択肢の API / アプリが許容する最大長（`notes/create` の JSON Schema 等）。
 *
 * @remarks
 * DB より短くし、連合ペイロードや入力体験を抑える。JSON Schema の `maxLength` は UTF-16 コード単位だが、本値は従来どおりの運用に合わせた目安として使う。
 */
export const APP_MAX_POLL_CHOICE_LENGTH = 200;
