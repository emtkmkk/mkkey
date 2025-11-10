export class DriveFileUsageCount1729000000001 {
        name = "DriveFileUsageCount1729000000001";

        async up(queryRunner) {
                await queryRunner.query(
                        'ALTER TABLE "drive_file" ADD "usageCount" integer NOT NULL DEFAULT 0',
                );
                await queryRunner.query(
                        'CREATE INDEX "IDX_drive_file_usage_count" ON "drive_file" ("usageCount")',
                );
        }

        async down(queryRunner) {
                await queryRunner.query(
                        'DROP INDEX "IDX_drive_file_usage_count"',
                );
                await queryRunner.query(
                        'ALTER TABLE "drive_file" DROP COLUMN "usageCount"',
                );
        }
}
