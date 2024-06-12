export class addFixedName1683682889977 {
	name = "addFixedName1683682889977";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "fixedName" character varying(128)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "fixedName"`);
	}
}
