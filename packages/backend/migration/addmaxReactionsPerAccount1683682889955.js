export class addmaxReactionsPerAccount1683682889955 {
	name = "addmaxReactionsPerAccount1683682889955";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "instance" ADD IF NOT EXISTS "maxReactionsPerAccount" integer NOT NULL DEFAULT 1`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "instance" DROP COLUMN "maxReactionsPerAccount"`,
		);
	}
}
