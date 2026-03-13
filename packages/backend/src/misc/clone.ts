/**
 * @packageDocumentation
 *
 * 深いコピー（deep clone）。structuredClone が遅いため自前実装を使用する。
 *
 * @remarks
 * - **役割**: AP オブジェクトやノート等のコピーが必要な箇所で、参照を切った複製を提供する。
 * - 参考: http://var.blog.jp/archives/86038606.html
 *
 * @internal
 */
type Cloneable =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Cloneable }
	| Cloneable[];

/**
 * オブジェクトを再帰的に深いコピーする。
 * @param x - コピー元（Cloneable 型）
 * @returns コピー結果
 * @internal
 */
export function deepClone<T extends Cloneable>(x: T): T {
	if (typeof x === "object") {
		if (x === null) return x;
		if (Array.isArray(x)) return x.map(deepClone) as T;
		const obj = {} as Record<string, Cloneable>;
		for (const [k, v] of Object.entries(x)) {
			obj[k] = deepClone(v);
		}
		return obj as T;
	} else {
		return x;
	}
}
