export class addMiniSilenced1683682889976 {
	name = "addMiniSilenced1683682889976";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "isMiniSilenced" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isMiniSilenced"`);
	}
}
