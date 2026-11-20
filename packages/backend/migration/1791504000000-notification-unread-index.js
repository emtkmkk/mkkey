/**
 * 未読の通知だけを対象にした部分インデックスを追加する。
 *
 * 「受信者の未読通知を新しい順に探す」クエリが、主キーを逆順にたどって isRead / notifieeId で絞っていた。
 * 未読が無いユーザーではテーブル全体（本番で約 260 万行）を読み切り、1 回 1〜2 秒かかっていた。
 * 未読は全体の 2% 程度なので、部分インデックスにすると数 MB で済む。
 *
 * ※ 本番（mkkey.net）では 2026-11-20 に CREATE INDEX CONCURRENTLY で作成済みのため IF NOT EXISTS を用いる。
 */
export class NotificationUnreadIndex1791504000000 {
	name = "NotificationUnreadIndex1791504000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_notification_unread_notifiee" ON "notification" ("notifieeId", "id") WHERE "isRead" = false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_notification_unread_notifiee"`,
		);
	}
}
