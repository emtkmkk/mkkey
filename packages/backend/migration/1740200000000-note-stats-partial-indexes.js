/**
 * users/stats 等の repliedCount / renotedCount 用 COUNT を高速化する partial index を追加する。
 * replyUserId, renoteUserId に対する visibility <> 'specified' 条件のクエリで利用される。
 */
export class noteStatsPartialIndexes1740200000000 {
	name = "noteStatsPartialIndexes1740200000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_note_reply_user_visible" ON "note" ("replyUserId") WHERE "visibility" <> 'specified'`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_note_renote_user_visible" ON "note" ("renoteUserId") WHERE "visibility" <> 'specified'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_note_reply_user_visible"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_note_renote_user_visible"`,
		);
	}
}
