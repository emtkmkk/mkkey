export class addInviteUserId1683682889951 {
    name = 'addInviteUserId1683682889951'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD IF NOT EXISTS "inviteUserId" text`);
        await queryRunner.query(`ALTER TABLE "user_pendings" ADD IF NOT EXISTS "inviteUserId" text`);
        await queryRunner.query(`ALTER TABLE "registration_ticket" ADD IF NOT EXISTS "inviteUserId" text`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "inviteUserId"`);
        await queryRunner.query(`ALTER TABLE "user_pendings" DROP COLUMN "inviteUserId"`);
        await queryRunner.query(`ALTER TABLE "registration_ticket" DROP COLUMN "inviteUserId"`);
    }

}