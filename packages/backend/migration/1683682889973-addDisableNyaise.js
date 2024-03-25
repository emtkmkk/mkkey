export class adddisableNyaise1683682889973 {
	name = "addPublicReactionList1683682889973";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "disableNyaise" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "disableNyaise"`);
	}
}
