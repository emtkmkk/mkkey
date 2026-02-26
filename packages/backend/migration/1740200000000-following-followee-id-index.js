/**
 * following テーブルの followeeId 単独インデックス追加。
 * 休眠フォロワー判定など「フォロワー一覧（followeeId 指定）」のクエリを高速化する。
 */
export class FollowingFolloweeIdIndex1740200000000 {
	name = "FollowingFolloweeIdIndex1740200000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX "IDX_following_followee_id" ON "following" ("followeeId")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX "public"."IDX_following_followee_id"`,
		);
	}
}
