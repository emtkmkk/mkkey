import { MigrationInterface, QueryRunner } from "typeorm";

export class addUserSetting1683682889949 implements MigrationInterface {
    name = 'addUserSetting1683682889949'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "blockPostPublic" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "blockPostHome" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "blockPostNotLocal" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "blockPostNotLocalPublic" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "isSilentLocked" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostPublic"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostHome"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostNotLocal"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostNotLocalPublic"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSilentLocked"`);
    }

}