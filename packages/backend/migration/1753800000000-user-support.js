/**
 * 月ごとの支援実績テーブルと、最終支援月カラム、自作絵文字ボーナスの適用回数カラムを追加する。
 *
 * @remarks
 * - `user_support` の (userId, month) 一意制約が二重適用の防止そのもの。
 * - `user.lastSupportedMonth` は「今月の支援者か」を user のパック時に安く判定するための非正規化。
 * - 数ヶ月分をまとめて反映しても行は増やさない。まとめた月数は `months` に持つ。
 * - `user.emojiDriveGrantCount` は自作絵文字ボーナス（1回 +1500MB、5回まで）の適用回数。
 */
export class userSupport1753800000000 {
	constructor() {
		this.name = "userSupport1753800000000";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "lastSupportedMonth" character varying(7) DEFAULT NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."lastSupportedMonth" IS 'The last month (YYYY-MM) the user was a supporter.'`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_user_lastSupportedMonth" ON "user" ("lastSupportedMonth")`,
		);

		await queryRunner.query(
			`ALTER TABLE "user" ADD "emojiDriveGrantCount" integer NOT NULL DEFAULT 0`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."emojiDriveGrantCount" IS 'How many times the self-made-emoji drive bonus has been granted.'`,
		);

		await queryRunner.query(`CREATE TABLE "user_support" (
			"id" character varying(32) NOT NULL,
			"userId" character varying(32) NOT NULL,
			"month" character varying(7) NOT NULL,
			"source" character varying(32) NOT NULL DEFAULT 'ofuse',
			"externalId" character varying(128),
			"plans" jsonb NOT NULL DEFAULT '[]',
			"grantMb" integer NOT NULL DEFAULT 0,
			"months" integer NOT NULL DEFAULT 1,
			"beforeMb" integer,
			"afterMb" integer NOT NULL,
			"appliedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"appliedById" character varying(32),
			CONSTRAINT "PK_user_support" PRIMARY KEY ("id")
		)`);
		await queryRunner.query(
			`CREATE INDEX "IDX_user_support_userId" ON "user_support" ("userId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_user_support_month" ON "user_support" ("month")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_user_support_appliedAt" ON "user_support" ("appliedAt")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_user_support_userId_month" ON "user_support" ("userId", "month")`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_support" ADD CONSTRAINT "FK_user_support_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "user_support"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "emojiDriveGrantCount"`);
		await queryRunner.query(`DROP INDEX "IDX_user_lastSupportedMonth"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastSupportedMonth"`);
	}
}
