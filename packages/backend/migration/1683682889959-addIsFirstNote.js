export class addIsFirstNote1683682889959 {
	name = "addIsFirstNote1683682889959";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ADD IF NOT EXISTS "isFirstNote" boolean NOT NULL DEFAULT FALSE`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "isFirstNote"`);
	}
}
