export class addReferencesIds1683682889974 {
	name = "addReferenceIds1683682889974";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ADD IF NOT EXISTS "referenceIds" character varying(32) array NOT NULL DEFAULT '{}'::varchar[]`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "referenceIds"`);
	}
}
