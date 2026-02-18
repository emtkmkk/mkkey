export class addGoogleIntegration1736000000000 {
	name = "addGoogleIntegration1736000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "enableGoogleIntegration" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "googleClientId" character varying(128)`,
		);
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "googleClientSecret" character varying(128)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "googleClientSecret"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "googleClientId"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableGoogleIntegration"`);
	}
}
