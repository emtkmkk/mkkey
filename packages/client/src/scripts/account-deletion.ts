/**
 * @packageDocumentation
 *
 * アカウント削除の予約で使う、画面側の共通の処理（日時の表示・予約の解除）。
 *
 * @remarks
 * - 日時はサーバーが決めて ISO 文字列で返すので、画面では表示するだけ（決め方は backend の
 *   misc/account-deletion-schedule.ts）。削除は日本時間 2:00 に行うので、表示も日本時間にする。
 * - 予約の解除は、申請画面と予約中の専用画面の両方から使うので、ここにまとめる。
 *
 * @internal
 */
import * as os from "@/os";
import { i18n } from "@/i18n";
import { updateAccount } from "@/account";

/**
 * ISO 文字列の日時を、日本時間の「11月28日 2:00」のような形にする。
 *
 * @param iso - 日時（ISO 文字列）
 * @returns 日本時間の月日と時刻（利用者の言語の書き方。日本時間だと分かるよう、時間帯の名前も付ける）
 * @internal
 */
export function formatJstDateTime(iso: string): string {
	return new Intl.DateTimeFormat(undefined, {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	}).format(new Date(iso));
}

/**
 * 確認のうえで、アカウント削除の予約を解除する。
 *
 * @returns 解除したら true（取り消した・失敗したら false）
 *
 * @remarks
 * - 確認のポップアップに「（日時）まで再び申請できなくなります」を出す。日時はサーバーが返す
 *   「今取り消したら再び予約できる日時」。
 * - 解除できたら、自分の情報の予約の日時を空にし、ページを読み直していつもの画面に戻す。
 *
 * @internal
 */
export async function cancelAccountDeletionWithConfirm(): Promise<boolean> {
	const state = await os.api("i/account-deletion/show");
	if (state.scheduledAt == null) {
		updateAccount({ accountDeletionScheduledAt: null });
		location.reload();
		return true;
	}

	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("_accountDelete.cancelConfirm", {
			date: formatJstDateTime(state.reRequestableAtIfCanceledNow ?? state.scheduledAt),
		}),
	});
	if (canceled) return false;

	try {
		await os.apiWithDialog("i/account-deletion/cancel");
	} catch {
		return false;
	}
	updateAccount({ accountDeletionScheduledAt: null });
	location.reload();
	return true;
}
