export class passkeyEnhancements1735000000000 {
	name = "passkeyEnhancements1735000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_security_key" ADD "signCount" integer NOT NULL DEFAULT 0`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."signCount" IS 'Signature counter from authenticatorData for replay detection.'`,
		);
		await queryRunner.query(
			`CREATE TABLE "passkey_login_challenge" ("id" character varying(32) NOT NULL, "challenge" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_passkey_login_challenge_id" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "passkey_login_challenge"."challenge" IS 'Hex-encoded sha256 hash of the challenge.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "passkey_login_challenge"."createdAt" IS 'The date challenge was created for expiry purposes.'`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_passkey_login_challenge_challenge" ON "passkey_login_challenge" ("challenge") `,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX "public"."IDX_passkey_login_challenge_challenge"`,
		);
		await queryRunner.query(`DROP TABLE "passkey_login_challenge"`);
		await queryRunner.query(`ALTER TABLE "user_security_key" DROP COLUMN "signCount"`);
	}
}
