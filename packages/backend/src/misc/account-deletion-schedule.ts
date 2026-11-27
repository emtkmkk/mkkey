/**
 * @packageDocumentation
 *
 * アカウント削除の予約で使う日時の決め方（日本時間）。
 *
 * @remarks
 * - 削除は日本時間 2:00 の定期ジョブで行う。予約した時刻が 20:00 より前なら翌日 2:00、
 *   20:00 以降なら翌々日 2:00 に削除する（予約した日の日付で数える。0:00〜2:00 の予約も「翌日」）。
 * - 取り消したら、取り消した時刻より後の最初の 20:00 まで再び予約できない。
 *   申請と取り消しを繰り返して、管理者への通知がうるさくならないようにするため。
 * - API・画面に返す日時・ジョブのすべてでこのファイルの関数を使う（決め方をずらさないため）。
 * - NB: 日本は夏時間が無いので、UTC+9 で固定して計算する。
 *
 * @see {@link services/account-deletion-schedule} 予約・取り消し
 * @internal
 */

/** 日本時間の UTC からのずれ（ミリ秒） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 削除の定期ジョブが動く時刻（日本時間の時）。
 *
 * @remarks
 * queue/index.ts のジョブの登録（cron）と合わせること。
 *
 * @internal
 */
export const ACCOUNT_DELETION_HOUR_JST = 2;

/**
 * 予約の締め切り時刻（日本時間の時）。これより前の予約は翌日、以降は翌々日に削除する。
 * 取り消したあとに再び予約できるようになる時刻でもある。
 *
 * @internal
 */
export const ACCOUNT_DELETION_CUTOFF_HOUR_JST = 20;

/**
 * 日本時間での年・月・日・時を取り出す。
 *
 * @param at - 日時
 * @returns 日本時間の年・月（0 始まり）・日・時
 * @internal
 */
function toJstParts(at: Date): { y: number; m: number; d: number; h: number } {
	const jst = new Date(at.getTime() + JST_OFFSET_MS);
	return {
		y: jst.getUTCFullYear(),
		m: jst.getUTCMonth(),
		d: jst.getUTCDate(),
		h: jst.getUTCHours(),
	};
}

/**
 * 日本時間の「ある日の何時」を Date にする。
 *
 * @param y - 年
 * @param m - 月（0 始まり）
 * @param d - 日（月末を越えても Date.UTC が繰り上げる）
 * @param h - 時
 * @returns その日時
 * @internal
 */
function jstDate(y: number, m: number, d: number, h: number): Date {
	return new Date(Date.UTC(y, m, d, h) - JST_OFFSET_MS);
}

/**
 * 今予約したときに削除される日時を決める。
 *
 * @param requestedAt - 予約する日時
 * @returns 削除される日時（日本時間 2:00）
 *
 * @example
 * ```ts
 * // 日本時間 11/27 10:00 → 11/28 2:00、11/27 21:00 → 11/29 2:00
 * computeAccountDeletionScheduledAt(new Date("2026-11-27T10:00:00+09:00"));
 * ```
 *
 * @internal
 */
export function computeAccountDeletionScheduledAt(requestedAt: Date): Date {
	const { y, m, d, h } = toJstParts(requestedAt);
	const days = h < ACCOUNT_DELETION_CUTOFF_HOUR_JST ? 1 : 2;
	return jstDate(y, m, d + days, ACCOUNT_DELETION_HOUR_JST);
}

/**
 * 取り消したあと、再び予約できるようになる日時を決める。
 *
 * @param canceledAt - 取り消した日時
 * @returns 取り消した時刻より後の、最初の日本時間 20:00
 *
 * @example
 * ```ts
 * // 日本時間 11:00 に取り消し → その日の 20:00、21:00 に取り消し → 翌日の 20:00
 * computeAccountDeletionReRequestableAt(new Date("2026-11-27T11:00:00+09:00"));
 * ```
 *
 * @internal
 */
export function computeAccountDeletionReRequestableAt(canceledAt: Date): Date {
	const { y, m, d } = toJstParts(canceledAt);
	const sameDay = jstDate(y, m, d, ACCOUNT_DELETION_CUTOFF_HOUR_JST);
	return sameDay.getTime() > canceledAt.getTime()
		? sameDay
		: jstDate(y, m, d + 1, ACCOUNT_DELETION_CUTOFF_HOUR_JST);
}

/**
 * 日時を日本時間の「2026年11月28日 2:00」の形にする（メールなどの文に使う）。
 *
 * @param at - 日時
 * @returns 日本時間の年月日と時刻
 * @internal
 */
export function formatJstDateTime(at: Date): string {
	const jst = new Date(at.getTime() + JST_OFFSET_MS);
	const minutes = String(jst.getUTCMinutes()).padStart(2, "0");
	return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日 ${jst.getUTCHours()}:${minutes}`;
}
