export class addNoteFavoriteNoteIdIndex1726166400001 {
        name = "addNoteFavoriteNoteIdIndex1726166400001";

        async up(queryRunner) {
                await queryRunner.query(
                        `CREATE INDEX IF NOT EXISTS "IDX_note_favorite_noteId" ON "note_favorite" ("noteId")`,
                );
        }

        async down(queryRunner) {
                await queryRunner.query(`DROP INDEX IF EXISTS "IDX_note_favorite_noteId"`);
        }
}
