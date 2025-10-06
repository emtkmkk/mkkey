export class cleanRemoteDriveFileIndex1727822400000 {
        name = "cleanRemoteDriveFileIndex1727822400000";

        async up(queryRunner) {
                await queryRunner.query(
                        `CREATE INDEX IF NOT EXISTS "IDX_NOTE_FILE_IDS" ON "note" USING GIN ("fileIds")`,
                );
                await queryRunner.query(
                        `CREATE INDEX IF NOT EXISTS "IDX_drive_file_userHost_createdAt" ON "drive_file" ("userHost", "createdAt", "id")`,
                );
        }

        async down(queryRunner) {
                await queryRunner.query(
                        `DROP INDEX IF EXISTS "IDX_drive_file_userHost_createdAt"`,
                );
                await queryRunner.query(`DROP INDEX IF EXISTS "IDX_NOTE_FILE_IDS"`);
        }
}
