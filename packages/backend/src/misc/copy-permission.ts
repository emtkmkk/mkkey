/**
 * コピー可否の DB 保存形（a/d/c/n）と API 返却形（allow/deny/conditional/none）の変換
 *
 * @packageDocumentation
 */

/** API・レスポンスで返す値 */
export const COPY_PERMISSION_FULL = [
	"allow",
	"deny",
	"conditional",
	"none",
] as const;

/** DB に保存する値（サイズ削減） */
export const COPY_PERMISSION_STORED = ["a", "d", "c", "n"] as const;

export type CopyPermissionFull = (typeof COPY_PERMISSION_FULL)[number];
export type CopyPermissionStored = (typeof COPY_PERMISSION_STORED)[number];

const FULL_TO_STORED: Record<string, CopyPermissionStored> = {
	allow: "a",
	deny: "d",
	conditional: "c",
	none: "n",
};

const STORED_TO_FULL: Record<string, CopyPermissionFull> = {
	a: "allow",
	d: "deny",
	c: "conditional",
	n: "none",
};

/**
 * API で受け取った値（allow/deny/conditional/none）を DB 保存用（a/d/c/n）に変換する
 *
 * @param full - 完全形。null/undefined はそのまま null を返す
 * @returns 保存形。未対応の値はそのまま返す（後方互換）
 */
export function toStoredCopyPermission(
	full: string | null | undefined,
): string | null {
	if (full == null || full === "") return null;
	const stored = FULL_TO_STORED[full.toLowerCase()];
	return stored ?? full;
}

/**
 * DB から読んだ値（a/d/c/n または旧来の完全形）を API 返却用（allow/deny/conditional/none）に変換する
 *
 * @param stored - 保存形または完全形
 * @returns 完全形。未対応の値はそのまま返す（後方互換）
 */
export function fromStoredCopyPermission(
	stored: string | null | undefined,
): string {
	if (stored == null || stored === "") return "none";
	const full = STORED_TO_FULL[stored];
	return full ?? stored;
}
