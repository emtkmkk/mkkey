export class AddPerformanceIncidentCollectionSetting1740300000000 {
	name = "AddPerformanceIncidentCollectionSetting1740300000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "enablePerformanceIncidentCollection" boolean NOT NULL DEFAULT true`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "meta" DROP COLUMN "enablePerformanceIncidentCollection"`,
		);
	}
}
