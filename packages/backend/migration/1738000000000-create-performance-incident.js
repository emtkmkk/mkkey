export class createPerformanceIncident1738000000000 {
	name = "createPerformanceIncident1738000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "performance_incident" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "severity" character varying(16) NOT NULL, "metric" character varying(64) NOT NULL, "value" double precision NOT NULL, "stats" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_performance_incident_id" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_performance_incident_createdAt" ON "performance_incident" ("createdAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_performance_incident_metric_createdAt" ON "performance_incident" ("metric", "createdAt")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_performance_incident_metric_createdAt"`);
		await queryRunner.query(`DROP INDEX "IDX_performance_incident_createdAt"`);
		await queryRunner.query(`DROP TABLE "performance_incident"`);
	}
}
