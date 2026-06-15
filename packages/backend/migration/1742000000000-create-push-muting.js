/**
 * プッシュ通知ミュート用 `push_muting` テーブルを作成する。
 */
export class CreatePushMuting1742000000000 {
	constructor() {
		this.name = "CreatePushMuting1742000000000";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "push_muting" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"muteeId" character varying(32) NOT NULL,
				"muterId" character varying(32) NOT NULL,
				CONSTRAINT "PK_pushMuting_id" PRIMARY KEY ("id")
			)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_push_muting_muterId_muteeId" ON "push_muting" ("muterId", "muteeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_push_muting_createdAt" ON "push_muting" ("createdAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_push_muting_muteeId" ON "push_muting" ("muteeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_push_muting_muterId" ON "push_muting" ("muterId")`,
		);
		await queryRunner.query(
			`COMMENT ON TABLE "push_muting" IS '特定ユーザからの Web Push のみを抑止する設定'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE IF EXISTS "push_muting"`);
	}
}
