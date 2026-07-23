/**
 * 周年バッジ（もこきー熟練）用のカラムと通知種別を追加する。
 *
 * @remarks
 * - `notesPostDays` は `users/stats` の都度集計とは独立した単調増加値。
 *   このマイグレーションで現存ノートの distinct 投稿日数を一度だけバックフィルする
 *   （`fetch-aggregates.ts` の primary 集計と同じ条件: visibility <> 'specified' かつ misshaialert タグ除外）。
 * - `notifiedAnniversaryLevel` はバックフィルしない（0のまま）。
 *   既存ユーザーは次回投稿時に現在の最高レベルで1回だけ通知される。
 * - enum 追加は `transaction = false` とし、55P04 を避ける。
 */
export class addAnniversaryBadge1753200000000 {
	constructor() {
		this.name = "addAnniversaryBadge1753200000000";
		this.transaction = false;
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "notesPostDays" integer NOT NULL DEFAULT 0`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."notesPostDays" IS '周年バッジ用の投稿日数（単調増加、削除では減らない）'`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD "lastNotePostedAt" TIMESTAMP WITH TIME ZONE`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."lastNotePostedAt" IS '周年バッジ用の投稿日マーカー'`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD "notifiedAnniversaryLevel" integer NOT NULL DEFAULT 0`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."notifiedAnniversaryLevel" IS '周年バッジで最後に通知したレベル（年数）'`,
		);

		await queryRunner.query(
			`ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'badge'`,
		);
		await queryRunner.query(
			`ALTER TYPE user_profile_mutingnotificationtypes_enum ADD VALUE IF NOT EXISTS 'badge'`,
		);

		// 現存ノートの distinct 投稿日数で notesPostDays を初期バックフィル（ローカルユーザーのみ）
		await queryRunner.query(`
			UPDATE "user" u
			SET "notesPostDays" = sub.days
			FROM (
				SELECT n."userId" AS uid, count(DISTINCT date_trunc('day', n."createdAt")) AS days
				FROM "note" n
				WHERE n.visibility <> 'specified'
					AND 'misshaialert' <> ALL(n.tags)
				GROUP BY n."userId"
			) sub
			WHERE u.id = sub.uid AND u.host IS NULL
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "notifiedAnniversaryLevel"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "lastNotePostedAt"`,
		);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notesPostDays"`);
	}
}
