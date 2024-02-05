export class addEmojiCreatedAt1683682889952 {
	name = "addEmojiCreatedAt1683682889952";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE`,
		);
		await queryRunner.query(`UPDATE "emoji" SET "createdAt" = "updatedAt"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "createdAt"`);
	}
}
