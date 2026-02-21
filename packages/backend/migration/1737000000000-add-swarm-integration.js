export class addSwarmIntegration1737000000000 {
	name = "addSwarmIntegration1737000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "enableSwarmIntegration" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "swarmClientId" character varying(128)`,
		);
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "swarmClientSecret" character varying(128)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "swarmClientSecret"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "swarmClientId"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableSwarmIntegration"`);
	}
}
