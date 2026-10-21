/**
 * user に localFollowedSince（ローカルからのフォローが最後に 0→1 人以上になった時刻）を追加する。
 *
 * @remarks
 * - リモートユーザーの「このサーバーがいつから投稿を追跡しているか」を公開するための列。
 * - 既存のフォローは、今いるローカルフォロワーの最古のフォロー日時で埋める。
 *   その日時からは途切れずに追跡していたことが確実なので、連続した期間として扱える
 *   （実際の開始はもっと前のことがある）。
 * - down は列を消すだけ。埋めた値は失われるが、up をやり直せば同じ値で埋め直せる。
 *
 * @internal
 */
export class UserLocalFollowedSince1791244800000 {
	name = "UserLocalFollowedSince1791244800000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "localFollowedSince" TIMESTAMP WITH TIME ZONE`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."localFollowedSince" IS 'When local followers of this remote user last went from 0 to 1 or more.'`,
		);
		await queryRunner.query(
			`UPDATE "user" u SET "localFollowedSince" = f."since"
			FROM (
				SELECT "followeeId", MIN("createdAt") AS "since"
				FROM "following"
				WHERE "followerHost" IS NULL AND "followeeHost" IS NOT NULL
				GROUP BY "followeeId"
			) f
			WHERE u."id" = f."followeeId"`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN IF EXISTS "localFollowedSince"`,
		);
	}
}
