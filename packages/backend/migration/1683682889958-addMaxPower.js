export class addMaxPower1683682889958 {
	name = "addMaxPower1683682889958";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "maxPower" integer NOT NULL DEFAULT 0`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "maxRankPoint" integer NOT NULL DEFAULT 0`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "maxPower"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "maxRankPoint"`);
	}
}
