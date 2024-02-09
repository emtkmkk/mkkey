export class noteCwTypeText1683682889970 {
	constructor() {
		this.name = "noteCwTypeText1683682889970";
	}

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" ALTER COLUMN "cw" TYPE text`);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ALTER COLUMN "cw" TYPE character varying(512)`,
		);
	}
}
