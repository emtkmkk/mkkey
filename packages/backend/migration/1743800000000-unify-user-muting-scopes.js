/**
 * ユーザー単位ミュートを範囲ビットマスクへ統合し、リアクション件数除外設定を追加する。
 *
 * @remarks
 * 既存の無期限RT・Push・フォロー操作ミュートと期限付き通常ミュートが重なる場合は、
 * 非表示を優先して統合後の期限を無期限にする。
 */
export class UnifyUserMutingScopes1743800000000 {
	name = "UnifyUserMutingScopes1743800000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "muting" ADD COLUMN IF NOT EXISTS "scope" integer NOT NULL DEFAULT 1`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "muting"."scope" IS 'ユーザー単位ミュートの対象範囲ビットマスク'`,
		);

		// 既存の個別ミュートは無期限だったため、重複時は統合行全体を無期限にする。
		await queryRunner.query(`
			INSERT INTO "muting" ("id", "createdAt", "expiresAt", "muteeId", "muterId", "scope")
			SELECT MIN("id"), MIN("createdAt"), NULL, "muteeId", "muterId", 4
			FROM "renote_muting"
			GROUP BY "muteeId", "muterId"
			ON CONFLICT ("muterId", "muteeId") DO UPDATE
			SET
				"scope" = "muting"."scope" | EXCLUDED."scope",
				"expiresAt" = NULL,
				"createdAt" = LEAST("muting"."createdAt", EXCLUDED."createdAt")
		`);
		await queryRunner.query(`
			INSERT INTO "muting" ("id", "createdAt", "expiresAt", "muteeId", "muterId", "scope")
			SELECT MIN("id"), MIN("createdAt"), NULL, "muteeId", "muterId", 16
			FROM "push_muting"
			GROUP BY "muteeId", "muterId"
			ON CONFLICT ("muterId", "muteeId") DO UPDATE
			SET
				"scope" = "muting"."scope" | EXCLUDED."scope",
				"expiresAt" = NULL,
				"createdAt" = LEAST("muting"."createdAt", EXCLUDED."createdAt")
		`);
		await queryRunner.query(`
			INSERT INTO "muting" ("id", "createdAt", "expiresAt", "muteeId", "muterId", "scope")
			SELECT MIN("id"), MIN("createdAt"), NULL, "blockeeId", "blockerId", 128
			FROM "follow_blocking"
			GROUP BY "blockeeId", "blockerId"
			ON CONFLICT ("muterId", "muteeId") DO UPDATE
			SET
				"scope" = "muting"."scope" | EXCLUDED."scope",
				"expiresAt" = NULL,
				"createdAt" = LEAST("muting"."createdAt", EXCLUDED."createdAt")
		`);

		await queryRunner.query(`DROP TABLE "renote_muting"`);
		await queryRunner.query(`DROP TABLE "push_muting"`);
		await queryRunner.query(`DROP TABLE "follow_blocking"`);

		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "hideMutedAndBlockedUserReactions" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."hideMutedAndBlockedUserReactions" IS 'ミュート・双方向ブロック対象のリアクションを表示件数から差し引く実験的設定'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "renote_muting" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"muteeId" character varying(32) NOT NULL,
				"muterId" character varying(32) NOT NULL,
				CONSTRAINT "PK_renoteMuting_id" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "push_muting" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"muteeId" character varying(32) NOT NULL,
				"muterId" character varying(32) NOT NULL,
				CONSTRAINT "PK_pushMuting_id" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "follow_blocking" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"blockeeId" character varying(32) NOT NULL,
				"blockerId" character varying(32) NOT NULL,
				CONSTRAINT "PK_followblocking_id" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			INSERT INTO "renote_muting" ("id", "createdAt", "muteeId", "muterId")
			SELECT "id", "createdAt", "muteeId", "muterId"
			FROM "muting"
			WHERE ("scope" & 4) <> 0 AND ("scope" & 1) = 0
			ON CONFLICT DO NOTHING
		`);
		await queryRunner.query(`
			INSERT INTO "push_muting" ("id", "createdAt", "muteeId", "muterId")
			SELECT "id", "createdAt", "muteeId", "muterId"
			FROM "muting"
			WHERE ("scope" & 16) <> 0 AND ("scope" & 1) = 0
			ON CONFLICT DO NOTHING
		`);
		await queryRunner.query(`
			INSERT INTO "follow_blocking" ("id", "createdAt", "blockeeId", "blockerId")
			SELECT "id", "createdAt", "muteeId", "muterId"
			FROM "muting"
			WHERE ("scope" & 128) <> 0 AND ("scope" & 1) = 0
			ON CONFLICT DO NOTHING
		`);

		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_renote_muting_muterId_muteeId" ON "renote_muting" ("muterId", "muteeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_renote_muting_createdAt" ON "renote_muting" ("createdAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_renote_muting_muteeId" ON "renote_muting" ("muteeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_renote_muting_muterId" ON "renote_muting" ("muterId")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_push_muting_muterId_muteeId" ON "push_muting" ("muterId", "muteeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_push_muting_createdAt" ON "push_muting" ("createdAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_push_muting_muteeId" ON "push_muting" ("muteeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_push_muting_muterId" ON "push_muting" ("muterId")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_follow_blocking_blockerId_blockeeId" ON "follow_blocking" ("blockerId", "blockeeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_follow_blocking_createdAt" ON "follow_blocking" ("createdAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_follow_blocking_muteeId" ON "follow_blocking" ("blockeeId")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_follow_blocking_muterId" ON "follow_blocking" ("blockerId")`,
		);

		// 個別範囲は旧スキーマで表現できないため、残るmuting行は従来の全体ミュートとして安全側へ戻す。
		await queryRunner.query(`ALTER TABLE "muting" DROP COLUMN IF EXISTS "scope"`);
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "hideMutedAndBlockedUserReactions"`,
		);
	}
}
