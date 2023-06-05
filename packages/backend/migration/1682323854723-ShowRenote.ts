import { MigrationInterface, QueryRunner } from "typeorm";

export class ShowRenote1682323854723 implements MigrationInterface {
    name = 'ShowRenote1682323854723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "localShowRenote" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "remoteShowRenote" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "showSelfRenoteToHome" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "localShowRenote"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "remoteShowRenote"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "showSelfRenoteToHome"`);
    }

}
