/**
 * users/notes のユーザタイムライン検索を高速化するため、
 * note テーブルに (userId, id DESC) の複合インデックスを追加する。
 * WHERE note.userId = :userId AND ORDER BY note.id DESC のパターンで利用される。
 */
export class NoteUserIdIdDescIndex1740600000000 {
	name = "NoteUserIdIdDescIndex1740600000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_note_userId_id_desc" ON "note" ("userId", "id" DESC)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_note_userId_id_desc"`,
		);
	}
}
