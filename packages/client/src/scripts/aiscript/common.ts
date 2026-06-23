/**
 * @packageDocumentation
 *
 * AiScript 拡張 API 向けの共通ヘルパー。
 *
 * @internal
 */
import { utils } from "@syuilo/aiscript";
import type { values } from "@syuilo/aiscript";

/**
 * 文字列値であることと、許可リストに含まれることを検証する。
 *
 * @param value - 検証対象
 * @param expects - 許可する文字列の一覧
 * @throws 型または値が不一致の場合
 * @internal
 */
export function assertStringAndIsIn<A extends readonly string[]>(
	value: values.Value | undefined,
	expects: A,
): asserts value is values.VStr & { value: A[number] } {
	utils.assertString(value);
	const str = value.value;
	if (!expects.includes(str as A[number])) {
		throw new Error(`expected one of ${expects.join(", ")}, got ${str}`);
	}
}
