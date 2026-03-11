/**
 * users/followers の「フォロワー一覧」検索を高速化するため、
 * following テーブルに (followeeId, id DESC) の複合インデックスを追加する。
 * WHERE followeeId = :userId ORDER BY id DESC のパターンで利用される。
 */
export class FollowingFolloweeIdIdDescIndex1740800000000 {
	name = "FollowingFolloweeIdIdDescIndex1740800000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_following_followeeId_id_desc" ON "following" ("followeeId", "id" DESC)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_following_followeeId_id_desc"`,
		);
	}
}
