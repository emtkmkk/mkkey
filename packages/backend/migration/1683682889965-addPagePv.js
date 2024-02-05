export class addPagePv1683682889965 {
	name = "addPagePv1683682889965";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "page" ADD IF NOT EXISTS "userpv" integer NOT NULL DEFAULT 0`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "page" DROP COLUMN "userpv"`);
	}
}
