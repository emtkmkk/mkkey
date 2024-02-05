export class addOldEmojiFlg1683682889956 {
	name = "addOldEmojiFlg1683682889956";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD IF NOT EXISTS "oldEmoji" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "oldEmoji"`);
	}
}
