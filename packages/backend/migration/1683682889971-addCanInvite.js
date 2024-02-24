export class addLastSendActivityAt1683682889964 {
	name = "addLastSendActivityAt1683682889964";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "canInvite" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "canInvite"`,
		);
	}
}
