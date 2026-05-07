/**
 * @packageDocumentation
 *
 * MOTD 用: お正月（翌年 1/1）までの「あと何夜寝るか」を数える計算。
 *
 * @remarks
 * - 生活リズム上の日付切り替えを **朝 6 時** とみなし、未満は前日扱いの「論理日」で数える。
 * - ターゲットはローカルタイムゾーンの **翌年 1 月 1 日 0:00**。論理日がその年の元日なら **0**。
 *
 * @internal
 */

/** 1 日のミリ秒（DST は考慮せず暦日差で計算）。 */
const MS_PER_DAY = 86400000;

/**
 * 朝 6 時を境にした「論理日」の、その日 0:00（ローカル）を返す。
 *
 * @param now - 現在時刻
 * @returns 論理日の開始（時分秒ミリ秒は 0）
 *
 * @remarks
 * `now.getHours() < 6` のときはカレンダーを 1 日前にずらす（深夜帯はまだ「昨日」の続きとして数える）。
 *
 * @internal
 */
export function getLogicalDateAtMidnight(now: Date): Date {
	const d = new Date(now);
	if (d.getHours() < 6) {
		d.setDate(d.getDate() - 1);
	}
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * 論理日の時刻から数えて、翌年の 1 月 1 日 0:00 までにあと何夜寝るか（暦日差）。
 *
 * @param now - 現在時刻（{@link getLogicalDateAtMidnight} と同じ 6 時閾値を適用）
 * @returns `0` 以上の整数。論理日が元日なら `0`。それ以外は `ceil((次年1/1 0:00 - 論理日 0:00) / 1日)`。
 *
 * @remarks
 * - **MOTD 文言**: `1 <= n <= 99` のときだけプールに載せる想定（それ以外は候補に入れない）。
 * - タイムゾーンは `Date` のローカル解釈に従う（日本のインスタンス想定）。
 *
 * @internal
 */
export function getSleepsUntilNextNewYearsDay(now: Date): number {
	const logical = getLogicalDateAtMidnight(now);
	if (logical.getMonth() === 0 && logical.getDate() === 1) {
		return 0;
	}
	const y = logical.getFullYear();
	const nextJan1 = new Date(y + 1, 0, 1);
	return Math.ceil(
		(nextJan1.getTime() - logical.getTime()) / MS_PER_DAY,
	);
}
