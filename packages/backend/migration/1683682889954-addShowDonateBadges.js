export class addShowDonateBadges1683682889954 {
	name = "addShowDonateBadges1683682889954";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD IF NOT EXISTS "showDonateBadges" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP COLUMN "showDonateBadges"`,
		);
	}
}
