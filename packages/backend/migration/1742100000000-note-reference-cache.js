/**
 * Note.hasReferences と note_reference_cache テーブルを追加する。
 */
export class NoteReferenceCache1742100000000 {
	name = "NoteReferenceCache1742100000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ADD IF NOT EXISTS "hasReferences" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "note_reference_cache" (
				"id" character varying(32) NOT NULL,
				"noteId" character varying(32) NOT NULL,
				"userId" character varying(32) NOT NULL,
				"referenceIds" character varying(32) array NOT NULL DEFAULT '{}',
				"fetchedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				CONSTRAINT "PK_note_reference_cache" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_note_reference_cache_note_user" ON "note_reference_cache" ("noteId", "userId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_note_reference_cache_noteId" ON "note_reference_cache" ("noteId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_note_reference_cache_userId" ON "note_reference_cache" ("userId")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE IF EXISTS "note_reference_cache"`);
		await queryRunner.query(
			`ALTER TABLE "note" DROP COLUMN IF EXISTS "hasReferences"`,
		);
	}
}
