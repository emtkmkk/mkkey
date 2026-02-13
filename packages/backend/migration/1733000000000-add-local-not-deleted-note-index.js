export class addLocalNotDeletedNoteIndex1733000000000 {
	name = "addLocalNotDeletedNoteIndex1733000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "idx_note_local_not_deleted_id" ON "note" USING btree ("id") WHERE "userHost" IS NULL AND "deletedAt" IS NULL`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_note_local_not_deleted_id"`);
	}
}
