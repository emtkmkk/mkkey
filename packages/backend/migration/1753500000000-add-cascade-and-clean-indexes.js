/**
 * note 削除時の FK カスケード削除で seq scan していた列にインデックスを追加する。
 *
 * notification.noteId / user_note_pining.noteId は @ManyToOne（onDelete: CASCADE）だが
 * 索引が無く、note 1件削除ごとに対象テーブルを seq scan していた。
 * note 単体削除（約430ms）・一括削除（約88秒）の遅延の主因。
 *
 * ※ user.avatarId / user.bannerId は @OneToOne により REL_* 一意索引が既に存在するため対象外。
 * ※ 本番では先に CREATE INDEX CONCURRENTLY で作成済みのことがあるため IF NOT EXISTS を用いる。
 */
export class AddCascadeAndCleanIndexes1753500000000 {
	name = "AddCascadeAndCleanIndexes1753500000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_notification_noteId" ON "notification" ("noteId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_user_note_pining_noteId" ON "user_note_pining" ("noteId")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_user_note_pining_noteId"`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_noteId"`);
	}
}
