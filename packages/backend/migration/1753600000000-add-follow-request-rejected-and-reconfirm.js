/**
 * フォロー申請拒否通知（followRequestRejected）と再フォロー確認テーブル（follow_reconfirm）を追加する。
 *
 * @remarks
 * - followRequestRejected は wasForciblyUnfollowed と同じ【dev】通知グループで扱うため、既存ユーザーはデフォルトミュートにする。
 * - enum 追加は `transaction = false` とし、55P04 を避ける。
 */
export class addFollowRequestRejectedAndReconfirm1753600000000 {
	constructor() {
		this.name = "addFollowRequestRejectedAndReconfirm1753600000000";
		this.transaction = false;
	}

	async up(queryRunner) {
		const newTypes = ["followRequestRejected"];

		for (const type of newTypes) {
			await queryRunner.query(
				`ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS '${type}'`,
			);
			await queryRunner.query(
				`ALTER TYPE user_profile_mutingnotificationtypes_enum ADD VALUE IF NOT EXISTS '${type}'`,
			);
		}

		await queryRunner.query(`
			UPDATE user_profile
			SET "mutingNotificationTypes" = (
				SELECT COALESCE(array_agg(DISTINCT e), '{}')
				FROM unnest(
					COALESCE("mutingNotificationTypes", '{}'::user_profile_mutingnotificationtypes_enum[])
					|| ARRAY['followRequestRejected']::user_profile_mutingnotificationtypes_enum[]
				) AS e
			)
		`);

		await queryRunner.query(`
			CREATE TYPE "follow_reconfirm_reason_enum" AS ENUM('followRequestRejected', 'wasForciblyUnfollowed')
		`);

		await queryRunner.query(`
			CREATE TABLE "follow_reconfirm" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"userId" character varying(32) NOT NULL,
				"targetUserId" character varying(32) NOT NULL,
				"reason" "follow_reconfirm_reason_enum" NOT NULL,
				CONSTRAINT "PK_follow_reconfirm_id" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_follow_reconfirm_userId" ON "follow_reconfirm" ("userId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_follow_reconfirm_targetUserId" ON "follow_reconfirm" ("targetUserId")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_follow_reconfirm_userId_targetUserId" ON "follow_reconfirm" ("userId", "targetUserId")`,
		);

		await queryRunner.query(`
			ALTER TABLE "follow_reconfirm"
			ADD CONSTRAINT "FK_follow_reconfirm_userId"
			FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "follow_reconfirm"
			ADD CONSTRAINT "FK_follow_reconfirm_targetUserId"
			FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "follow_reconfirm" DROP CONSTRAINT "FK_follow_reconfirm_targetUserId"`,
		);
		await queryRunner.query(
			`ALTER TABLE "follow_reconfirm" DROP CONSTRAINT "FK_follow_reconfirm_userId"`,
		);
		await queryRunner.query(`DROP TABLE "follow_reconfirm"`);
		await queryRunner.query(`DROP TYPE "follow_reconfirm_reason_enum"`);

		await queryRunner.query(
			`UPDATE user_profile SET "mutingNotificationTypes" = array_remove("mutingNotificationTypes", 'followRequestRejected')`,
		);
	}
}
