export class pollHideResults1732000000000 {
	name = "pollHideResults1732000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "poll" ADD COLUMN "hideResults" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "hideResults"`);
	}
}
