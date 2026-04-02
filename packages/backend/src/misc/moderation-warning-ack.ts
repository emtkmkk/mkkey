/**
 * @packageDocumentation
 *
 * モデレーション警告の「当日分を API で ACK したか」の判定。
 *
 * @remarks
 * - `i` 応答の `needsModerationWarningPopup`・API ゲート・ストリーム接続で同じ定義を使う。
 * - UTC 日付で「今日」と `moderationWarningPopupAt` を比較する（`i` エンドポイントと同一）。
 *
 * @internal
 */

/**
 * UTC 日付キー（YYYY-MM-DD）
 *
 * @param d - 基準日時
 */
export function utcDateKey(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * 警告付きかつ当日まだ `i/ack-moderation-warning` 相当の確認が済んでいないとき true。
 *
 * @param user - `isModerationWarning` と `moderationWarningPopupAt` が取れればよい
 */
export function isModerationWarningAckPending(user: {
	isModerationWarning: boolean;
	moderationWarningPopupAt: Date | string | null | undefined;
}): boolean {
	if (user.isModerationWarning !== true) {
		return false;
	}
	const today = utcDateKey(new Date());
	const at = user.moderationWarningPopupAt;
	const lastDay =
		at != null && at !== ""
			? utcDateKey(typeof at === "string" ? new Date(at) : (at as Date))
			: null;
	return lastDay !== today;
}
