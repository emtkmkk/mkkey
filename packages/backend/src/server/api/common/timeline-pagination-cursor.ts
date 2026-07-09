/**
 * @packageDocumentation
 *
 * タイムライン系ページングのキーセットカーソル用ユーティリティ。
 *
 * @remarks
 * {@link makePaginationQuery} の ORDER BY と常に同期している必要がある。
 *
 * @see {@link makePaginationQuery}
 * @internal
 */

import type { SelectQueryBuilder } from "typeorm";

/** {@link makePaginationQuery} と同型のページング引数 */
export type TimelinePaginationParams = {
	sinceId?: string;
	untilId?: string;
	sinceDate?: number;
	untilDate?: number;
};

/**
 * {@link makePaginationQuery} の ORDER BY と一致する「次バッチは id のどちら側か」。
 *
 * @param ps - sinceId / untilId / sinceDate / untilDate
 * @returns ASC ページングなら true（カーソルは `id >`）
 *
 * @internal
 */
export function isPaginationQueryAsc(ps: TimelinePaginationParams): boolean {
	if (ps.sinceId && ps.untilId) return false;
	if (ps.sinceId) return true;
	if (ps.untilId) return false;
	if (ps.sinceDate != null && ps.untilDate != null) return false;
	if (ps.sinceDate != null) return true;
	if (ps.untilDate != null) return false;
	return false;
}

/**
 * キーセットカーソル条件を QueryBuilder に付与する。
 *
 * @param qb - 複製済みのクエリ
 * @param alias - ノートエイリアス
 * @param cursor - 直前バッチ最後の raw 行 id
 * @param asc - true なら `id > cursor`、false なら `id < cursor`
 * @param parameterName - バインド名
 *
 * @internal
 */
export function applyKeysetCursorToQuery<T>(
	qb: SelectQueryBuilder<T>,
	alias: string,
	cursor: string,
	asc: boolean,
	parameterName: string,
): void {
	if (asc) {
		qb.andWhere(`${alias}.id > :${parameterName}`, {
			[parameterName]: cursor,
		});
	} else {
		qb.andWhere(`${alias}.id < :${parameterName}`, {
			[parameterName]: cursor,
		});
	}
}
