/**
 * users/following の「フォロー一覧」検索を高速化するため、
 * following テーブルに (followerId, id DESC) の複合インデックスを追加する。
 * WHERE followerId = :userId AND ORDER BY id DESC のパターンで利用される。
 */
export class FollowingFollowerIdIdDescIndex1740700000000 {
	name = "FollowingFollowerIdIdDescIndex1740700000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_following_followerId_id_desc" ON "following" ("followerId", "id" DESC)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_following_followerId_id_desc"`,
		);
	}
}
