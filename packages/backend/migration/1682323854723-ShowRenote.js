export class ShowRenote1682323854723 {
    name = 'ShowRenote1682323854723'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "localShowRenote" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "remoteShowRenote" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "showSelfRenoteToHome" boolean NOT NULL DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "localShowRenote"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "remoteShowRenote"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "showSelfRenoteToHome"`);
    }

}
