export class addIsRemoteLocked1683682889961 {
    name = 'addIsRemoteLocked1683682889961'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD IF NOT EXISTS "isRemoteLocked" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isRemoteLocked"`);
    }

}
