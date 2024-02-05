export class addDeletedAt1683682889960 {
	name = "addDeletedAt1683682889960";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ADD IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "deletedAt"`);
	}
}
