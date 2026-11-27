/**
 * @packageDocumentation
 *
 * 自分のアカウントの削除を予約する API エンドポイント（互換のための名前）。
 *
 * @remarks
 * - **API パス**: `i/delete-account`（POST `/api/i/delete-account` で呼び出し）
 * - CHANGED: すぐに削除するのではなく、`i/account-deletion/request` と同じく予約する。
 *   以前は処理の先頭で止めてあり（`if (true || …) return;`）、何もしていなかった。
 *   削除は日本時間 2:00 の定期ジョブが予定日時に行う。
 * - 中身は `i/account-deletion/request` をそのまま使う（本人確認・エラーも同じ）。
 *
 * @see {@link endpoints/i/account-deletion/request} 予約の API
 * @internal
 */
export { meta, paramDef, default } from "./account-deletion/request.js";
