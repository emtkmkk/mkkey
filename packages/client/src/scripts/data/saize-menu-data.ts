/**
 * @packageDocumentation
 *
 * saize MFM 向けに、商品コード → **表示名文字列**のマップを読み込むモジュール。
 * 表示名は **文字列のみ**を JSON に保持し、`id` はキーと同一のため重複して持たない。
 *
 * @remarks
 * **`items` の形（容量優先）**
 * - キー: 4 桁商品コード（文字列）。
 * - 値: **表示名のみ（文字列）**。数値 `id` が必要なときは `parseInt(code, 10)` とみなす（表示はコード文字列をそのまま使うと先頭ゼロを壊さない）。
 *
 * @public
 */

import raw from "./saize-menu.json";

/**
 * 商品コード（大文字）→ 表示名。
 *
 * @public
 */
export type SaizeMenuItemsMap = Record<string, string>;

/**
 * `saize-menu.json` 全体の型（`import` 推論に追従）。
 *
 * @public
 */
export type SaizeMenuFile = typeof raw;

/**
 * パース済み `saize-menu.json`（`meta.generatedAt` と `items`）。
 *
 * @public
 */
export const saizeMenuFile: SaizeMenuFile = raw;

/**
 * 商品コード（大文字）→ 表示名。
 *
 * @public
 */
export const saizeMenuItems: SaizeMenuItemsMap = raw.items;
