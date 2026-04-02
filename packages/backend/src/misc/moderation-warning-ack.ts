/**
 * @packageDocumentation
 *
 * モデレーション警告の「当日分を API で ACK したか」の判定。
 *
 * @remarks
 * - `i` 応答の `needsModerationWarningPopup`・API ゲート・ストリーム接続で同じ定義を使う。
 * - UTC 日付で「今日」と `moderationWarningPopupAt` を比較する（`i` エンドポイントと同一）。
 * - `moderationWarningPopupAt` の実体は `moderation_warning_popup_ack` 行（認証時は `hydrateModerationWarningPopupAtForAuthUser` で注入）。
 * - 通常ユーザ向けに、`isModerationWarning` が真のときだけ別表を読む（警告でない場合は DB に行かず `null` を載せる）。
 *
 * @internal
 */

import { ModerationWarningPopupAcks } from "@/models/index.js";

/**
 * 認証ユーザオブジェクトに、別表の最終ACK時刻を載せる（API / ストリームのゲート判定用）。
 *
 * @param user - `id` と `isModerationWarning`（`AUTH_USER_SELECT` 済み）。`moderationWarningPopupAt` を上書きする。
 *
 * @remarks
 * `AUTH_USER_SELECT` から ACK 列は外している。警告ユーザのみ `moderation_warning_popup_ack` を1回読む。
 * 非警告時はクエリせず `moderationWarningPopupAt` を `null` にし、Redis キャッシュに残った古い値も無効化する。
 *
 * @internal
 */
export async function hydrateModerationWarningPopupAtForAuthUser(user: {
	id: string;
	isModerationWarning?: boolean;
	moderationWarningPopupAt?: Date | string | null;
}): Promise<void> {
	if (user.isModerationWarning !== true) {
		user.moderationWarningPopupAt = null;
		return;
	}
	const row = await ModerationWarningPopupAcks.findOne({
		where: { userId: user.id },
		select: { acknowledgedAt: true },
	});
	user.moderationWarningPopupAt = row?.acknowledgedAt ?? null;
}

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
 * @param user - `isModerationWarning` と任意で `moderationWarningPopupAt`（未注入・未ACK は undefined / null）
 */
export function isModerationWarningAckPending(user: {
	isModerationWarning: boolean;
	moderationWarningPopupAt?: Date | string | null | undefined;
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
