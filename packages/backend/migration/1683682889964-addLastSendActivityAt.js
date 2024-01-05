export class addLastSendActivityAt1683682889964 {
    name = 'addLastSendActivityAt1683682889964'

    async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" ADD IF NOT EXISTS "lastSendActivityAt" TIMESTAMP WITH TIME ZONE`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "lastSendActivityAt"`);
    }

}
