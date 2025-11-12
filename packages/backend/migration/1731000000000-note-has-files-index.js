export class noteHasFilesIndex1731000000000 {
        name = "noteHasFilesIndex1731000000000";

        async up(queryRunner) {
                await queryRunner.query(
                        `CREATE INDEX IF NOT EXISTS "IDX_note_has_files" ON "note" USING btree ("id") WHERE CARDINALITY("fileIds") > 0`,
                );
        }

        async down(queryRunner) {
                await queryRunner.query(`DROP INDEX IF EXISTS "IDX_note_has_files"`);
        }
}
