import { MigrationInterface, QueryRunner } from "typeorm";

export class ShowRenote1682323854723 implements MigrationInterface {
    name = 'addUserSetting1683682889949'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "blockPostPublic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "blockPostHome" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "blockPostNotLocal" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "isSilentLocked" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostPublic"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostHome"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostNotLocal"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSilentLocked"`);
    }

}