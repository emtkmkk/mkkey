/**
 * モデレーション警告・一時利用停止・警告ポップアップ記録（user）、
 * 公開TLの警告ユーザ表示・警告ユーザからのリアクション受容（user_profile）を追加する。
 */
export class ModerationWarningUsagePause1741200000000 {
	name = "ModerationWarningUsagePause1741200000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isModerationWarning" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isModerationWarning" IS 'モデレーション警告フラグ（ローカル・リモートユーザ行に付与可）'`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "moderationWarningPopupAt" TIMESTAMP WITH TIME ZONE`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."moderationWarningPopupAt" IS '警告ポップアップを最後に確認したUTC基準の記録'`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isUsagePaused" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isUsagePaused" IS '一時利用停止（凍結と別・連合Deleteは出さない）'`,
		);

		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "showWarnedUsersInPublicTimeline" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."showWarnedUsersInPublicTimeline" IS '公開TL等で警告ユーザのノートを閲覧者として表示する'`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "receiveReactionsFromNonFollowedWarnedUsers" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."receiveReactionsFromNonFollowedWarnedUsers" IS 'フォローしていない警告ユーザからのリアクションを投稿者として受け入れる'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "receiveReactionsFromNonFollowedWarnedUsers"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "showWarnedUsersInPublicTimeline"`,
		);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "isUsagePaused"`);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN IF EXISTS "moderationWarningPopupAt"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN IF EXISTS "isModerationWarning"`,
		);
	}
}
