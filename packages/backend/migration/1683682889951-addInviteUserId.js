export class addInviteUserId1683682889951 {
	name = "addInviteUserId1683682889951";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "inviteUserId" varchar(10)`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_pending" ADD IF NOT EXISTS "inviteUserId" varchar(10)`,
		);
		await queryRunner.query(
			`ALTER TABLE "registration_ticket" ADD IF NOT EXISTS "inviteUserId" varchar(10)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "inviteUserId"`);
		await queryRunner.query(
			`ALTER TABLE "user_pending" DROP COLUMN "inviteUserId"`,
		);
		await queryRunner.query(
			`ALTER TABLE "registration_ticket" DROP COLUMN "inviteUserId"`,
		);
	}
}
