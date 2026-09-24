/**
 * @packageDocumentation
 *
 * SQL の文字列リテラルを組み立てるためのエスケープ関数
 *
 * @remarks
 * NOTE: 可能な限りクエリパラメータ（`:name` / `$1`）を使うこと。
 * この関数は TypeORM の `() => string` 形式の式のように、パラメータを渡しにくい場所でだけ使う。
 *
 * @internal
 */

/**
 * 文字列を SQL の文字列リテラル（単引用符で囲まれた形）にエスケープする
 *
 * @remarks
 * - `standard_conforming_strings` が有効（PostgreSQL 9.1 以降の既定）な前提で、
 *   単引用符リテラル内で特別扱いされる文字は単引用符のみなので、それを二重化する。
 * - 配列リテラル（`'{...}'`）の中はさらに独自のエスケープ規則を持つので、
 *   配列を作る場合はこの関数の結果を `ARRAY[...]` コンストラクタに渡すこと。
 *
 * @param value - エスケープする文字列
 * @returns 単引用符で囲まれた SQL 文字列リテラル
 * @example
 * ```ts
 * sqlStringEscape("a'b"); // => "'a''b'"
 * ```
 * @internal
 */
export function sqlStringEscape(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}
