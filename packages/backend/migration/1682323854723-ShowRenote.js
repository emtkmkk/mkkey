export class ShowRenote1682323854723 {
	name = "ShowRenote1682323854723";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "localShowRenote" boolean NOT NULL DEFAULT true`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "remoteShowRenote" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "showSelfRenoteToHome" boolean NOT NULL DEFAULT true`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "localShowRenote"`);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "remoteShowRenote"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "showSelfRenoteToHome"`,
		);
	}
}
