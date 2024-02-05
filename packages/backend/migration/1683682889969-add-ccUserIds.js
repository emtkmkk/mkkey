export class addCcUserIds1683682889969 {
	constructor() {
		this.name = "addCcUserIds1683682889969";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ADD IF NOT EXISTS "ccUserIds" character varying(32) array NOT NULL DEFAULT '{}'::varchar[]`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_NOTE_CCUSERIDS" ON "note" ("ccUserIds")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "ccUserIds"`);
	}
}
