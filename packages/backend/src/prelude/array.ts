/**
 * @packageDocumentation
 *
 * 配列ユーティリティ。カウント・結合・差分・一意化・辞書順比較など。
 *
 * @remarks
 * - **役割**: サービス・API・MFM 等で配列操作の共通ユーティリティとして利用する。
 *
 * @internal
 */
import type { EndoRelation, Predicate } from "./relation.js";

/**
 * 述語を満たす要素の個数を返す。
 * @internal
 */
export function countIf<T>(f: Predicate<T>, xs: T[]): number {
	return xs.filter(f).length;
}

/**
 * 指定要素と等しい要素の個数を返す。
 * @internal
 */
export function count<T>(a: T, xs: T[]): number {
	return countIf((x) => x === a, xs);
}

/**
 * 配列の配列を平坦化して結合する。
 * @internal
 */
export function concat<T>(xss: T[][]): T[] {
	return ([] as T[]).concat(...xss);
}

/**
 * 配列の各要素の間に sep を挟んだ配列を返す。
 * @param sep - 挟む要素
 * @internal
 */
export function intersperse<T>(sep: T, xs: T[]): T[] {
	return concat(xs.map((x) => [sep, x])).slice(1);
}

/**
 * 指定要素と等しくない要素だけの配列を返す。
 * @internal
 */
export function erase<T>(a: T, xs: T[]): T[] {
	return xs.filter((x) => x !== a);
}

/**
 * 第1引数に含まれ第2引数に含まれない要素の配列を返す。順序は第1引数に従う。
 * @internal
 */
export function difference<T>(xs: T[], ys: T[]): T[] {
	return xs.filter((x) => !ys.includes(x));
}

/**
 * 同値グループの先頭以外を除いた配列を返す（重複除去）。
 * @internal
 */
export function unique<T>(xs: T[]): T[] {
	return [...new Set(xs)];
}

/** 数値配列の合計を返す。 @internal */
export function sum(xs: number[]): number {
	return xs.reduce((a, b) => a + b, 0);
}

/** 数値配列の最大値を返す。 @internal */
export function maximum(xs: number[]): number {
	return Math.max(...xs);
}

/**
 * 同値関係で配列を分割する。結果を結合すると元の配列と一致する。
 * @internal
 */
export function groupBy<T>(f: EndoRelation<T>, xs: T[]): T[][] {
	const groups = [] as T[][];
	for (const x of xs) {
		if (groups.length !== 0 && f(groups[groups.length - 1][0], x)) {
			groups[groups.length - 1].push(x);
		} else {
			groups.push([x]);
		}
	}
	return groups;
}

/**
 * 関数で誘導された同値関係で配列を分割する。結果を結合すると元の配列と一致する。
 * @internal
 */
export function groupOn<T, S>(f: (x: T) => S, xs: T[]): T[][] {
	return groupBy((a, b) => f(a) === f(b), xs);
}

/** キーセレクタでグループ化したオブジェクトを返す。 @internal */
export function groupByX<T>(collections: T[], keySelector: (x: T) => string) {
	return collections.reduce((obj: Record<string, T[]>, item: T) => {
		const key = keySelector(item);
		if (!Object.prototype.hasOwnProperty.call(obj, key)) {
			obj[key] = [];
		}

		obj[key].push(item);

		return obj;
	}, {});
}

/**
 * 2つの配列を辞書順で比較し、xs < ys なら true を返す。
 * @internal
 */
export function lessThan(xs: number[], ys: number[]): boolean {
	for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
		if (xs[i] < ys[i]) return true;
		if (xs[i] > ys[i]) return false;
	}
	return xs.length < ys.length;
}

/**
 * 述語を満たす最長の先頭部分配列を返す。
 * @internal
 */
export function takeWhile<T>(f: Predicate<T>, xs: T[]): T[] {
	const ys = [];
	for (const x of xs) {
		if (f(x)) {
			ys.push(x);
		} else {
			break;
		}
	}
	return ys;
}

/** 累積和の配列を返す。 @internal */
export function cumulativeSum(xs: number[]): number[] {
	const ys = Array.from(xs); // コピーを作成
	for (let i = 1; i < ys.length; i++) ys[i] += ys[i - 1];
	return ys;
}

/** 単一値または配列を配列に正規化する。 @internal */
export function toArray<T>(x: T | T[] | undefined): T[] {
	return Array.isArray(x) ? x : x != null ? [x] : [];
}

/** 単一値または配列を単一値に正規化する。 @internal */
export function toSingle<T>(x: T | T[] | undefined): T | undefined {
	return Array.isArray(x) ? x[0] : x;
}
