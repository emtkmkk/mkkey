/**
 * @packageDocumentation
 *
 * SQL の LIKE / ILIKE に利用者の入力を埋め込むときのエスケープ。
 *
 * @internal
 */

/**
 * LIKE の特別な文字（`%` `_` `\`）を、ただの文字として扱われるようにする。
 *
 * @param s - 利用者が入れた検索語
 * @returns エスケープした文字列（前後の `%` は呼び出し側で付ける）
 *
 * @remarks
 * - PostgreSQL の LIKE は、何も指定しなければ `\` をエスケープ文字として使う。
 * - CHANGED: 以前は `\` をエスケープしておらず、`\` を含む検索語で次の文字の意味が変わっていた。
 *
 * @example
 * ```ts
 * qb.where("x.name ILIKE :q", { q: `%${sqlLikeEscape(input)}%` });
 * ```
 *
 * @internal
 */
export function sqlLikeEscape(s: string) {
	return s.replace(/([\\%_])/g, "\\$1");
}
