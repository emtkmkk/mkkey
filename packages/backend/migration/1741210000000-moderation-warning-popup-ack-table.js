/**
 * `moderation_warning_popup_ack` テーブルへ `user.moderationWarningPopupAt` を移し、user 列を削除する。
 */
export class ModerationWarningPopupAckTable1741210000000 {
	name = "ModerationWarningPopupAckTable1741210000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "moderation_warning_popup_ack" (
				"userId" varchar(32) NOT NULL,
				"acknowledgedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				CONSTRAINT "PK_moderation_warning_popup_ack" PRIMARY KEY ("userId"),
				CONSTRAINT "FK_moderation_warning_popup_ack_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
			)`,
		);
		await queryRunner.query(
			`COMMENT ON TABLE "moderation_warning_popup_ack" IS '警告ポップアップ最終確認（一度でもACKしたユーザのみ行がある）'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "moderation_warning_popup_ack"."acknowledgedAt" IS '警告ポップアップを最後に確認したUTC基準の記録'`,
		);
		await queryRunner.query(
			`INSERT INTO "moderation_warning_popup_ack" ("userId", "acknowledgedAt")
			SELECT "id", "moderationWarningPopupAt" FROM "user" WHERE "moderationWarningPopupAt" IS NOT NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN IF EXISTS "moderationWarningPopupAt"`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "moderationWarningPopupAt" TIMESTAMP WITH TIME ZONE`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."moderationWarningPopupAt" IS '警告ポップアップを最後に確認したUTC基準の記録'`,
		);
		await queryRunner.query(
			`UPDATE "user" u SET "moderationWarningPopupAt" = a."acknowledgedAt"
			FROM "moderation_warning_popup_ack" a WHERE u."id" = a."userId"`,
		);
		await queryRunner.query(
			`DROP TABLE IF EXISTS "moderation_warning_popup_ack"`,
		);
	}
}
