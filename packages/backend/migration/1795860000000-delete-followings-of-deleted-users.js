/**
 * 削除済みアカウントが関わるフォロー関係（している・されている）を消す。
 *
 * - アカウント削除ジョブのフォロー解除は、失敗を黙って握り潰していたため、消しきれずに残った分がある
 *   （2026-11-27 時点で本番に 98 件。2023〜2024 年の分が多い）。1 回だけ掃除する。
 *   以降は削除ジョブが失敗をログに残すので、原因を追えるようになる。
 * - 消した分だけ、相手側（削除されていないローカルユーザー）の followersCount / followingCount を減らす。
 *   リモートのユーザーの件数は相手のサーバーから取ってくる値なので触らない。
 * - 同じユーザーの行を 1 つの文で 2 回更新しないよう、消した行を一時テーブルに控えてから順に直す。
 *   NB: 1 文ごとに確定される設定でも動くよう、ON COMMIT DROP は使わず最後に自分で消す。
 * - NB: ユーザーごとのフォロー数のチャート（per_user_following）は直さない。過去の推移の記録なので。
 * - down では元に戻せない（消した行は復元できない）ため何もしない。
 */
export class DeleteFollowingsOfDeletedUsers1795860000000 {
	name = "DeleteFollowingsOfDeletedUsers1795860000000";

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TEMP TABLE "tmp_deleted_following" AS
			SELECT f."id", f."followerId", f."followeeId"
			FROM "following" f
			JOIN "user" a ON a."id" = f."followerId"
			JOIN "user" b ON b."id" = f."followeeId"
			WHERE a."isDeleted" = true OR b."isDeleted" = true
		`);

		await queryRunner.query(`
			DELETE FROM "following" f
			USING "tmp_deleted_following" t
			WHERE f."id" = t."id"
		`);

		// フォローされていた側（削除されていないローカルユーザー）のフォロワー数を減らす
		await queryRunner.query(`
			UPDATE "user" u
			SET "followersCount" = GREATEST(u."followersCount" - c."n", 0)
			FROM (SELECT "followeeId" AS "id", count(*) AS "n" FROM "tmp_deleted_following" GROUP BY 1) c
			WHERE u."id" = c."id" AND u."host" IS NULL AND u."isDeleted" = false
		`);

		// フォローしていた側（削除されていないローカルユーザー）のフォロー数を減らす
		await queryRunner.query(`
			UPDATE "user" u
			SET "followingCount" = GREATEST(u."followingCount" - c."n", 0)
			FROM (SELECT "followerId" AS "id", count(*) AS "n" FROM "tmp_deleted_following" GROUP BY 1) c
			WHERE u."id" = c."id" AND u."host" IS NULL AND u."isDeleted" = false
		`);

		await queryRunner.query(`DROP TABLE "tmp_deleted_following"`);
	}

	async down() {
		// 消したフォロー関係は復元できないため何もしない
	}
}
