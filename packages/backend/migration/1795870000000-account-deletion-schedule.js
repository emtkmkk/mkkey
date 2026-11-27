/**
 * ローカルのアカウント削除の予約を持つ表 `account_deletion_schedule` を作る。
 *
 * - 本人が削除を予約すると行ができ、日本時間 2:00 の定期ジョブが予定日時を過ぎたものを削除する。
 * - 行ができるのは一度でも予約したローカルのユーザーだけなので小さい。`user` に列を足さないのは、
 *   リモートのユーザーの分を含めて数十万行あり、予約はローカルだけの話だから。
 * - `user` が消えたら行も消える（ON DELETE CASCADE）。
 * - ジョブは「予約中（scheduledAt が空でない）」の行だけを見るので、その部分だけのインデックスを張る。
 * - down では表ごと消す（予約の記録も消える）。
 */
export class AccountDeletionSchedule1795870000000 {
	name = "AccountDeletionSchedule1795870000000";

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "account_deletion_schedule" (
				"userId" character varying(32) NOT NULL,
				"requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"scheduledAt" TIMESTAMP WITH TIME ZONE,
				"canceledAt" TIMESTAMP WITH TIME ZONE,
				"executedAt" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_account_deletion_schedule_userId" PRIMARY KEY ("userId"),
				CONSTRAINT "FK_account_deletion_schedule_userId" FOREIGN KEY ("userId")
					REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_account_deletion_schedule_scheduledAt"
			ON "account_deletion_schedule" ("scheduledAt")
			WHERE "scheduledAt" IS NOT NULL
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_account_deletion_schedule_scheduledAt"`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "account_deletion_schedule"`);
	}
}
