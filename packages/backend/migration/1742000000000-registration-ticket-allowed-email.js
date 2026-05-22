/**
 * メール指定・1回限り招待コード用に registration_ticket.allowedEmail を追加する。
 */
export class RegistrationTicketAllowedEmail1742000000000 {
	name = "RegistrationTicketAllowedEmail1742000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "registration_ticket" ADD IF NOT EXISTS "allowedEmail" character varying(128)`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_registration_ticket_allowedEmail" ON "registration_ticket" ("allowedEmail") WHERE "allowedEmail" IS NOT NULL`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_registration_ticket_allowedEmail"`,
		);
		await queryRunner.query(
			`ALTER TABLE "registration_ticket" DROP COLUMN IF EXISTS "allowedEmail"`,
		);
	}
}
