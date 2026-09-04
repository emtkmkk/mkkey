/**
 * 支援実績の「月」を表す `YYYY-MM` を扱うヘルパー。
 *
 * @remarks
 * - 月境界は JST 固定。UTC+9 に DST は無いので固定オフセットで足りる。
 * - `Intl` は user のパックのような高頻度経路で使うには重いため、素の計算にしている。
 */

/** 現在の支援対象月（JST）を `YYYY-MM` で返す。 */
export function currentSupportMonth(now: Date | number = Date.now()): string {
	const ms = typeof now === "number" ? now : now.getTime();
	return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/** `lastSupportedMonth` が当月かどうか。 */
export function isMonthlySupporter(
	lastSupportedMonth: string | null | undefined,
	now: Date | number = Date.now(),
): boolean {
	return lastSupportedMonth != null && lastSupportedMonth === currentSupportMonth(now);
}
