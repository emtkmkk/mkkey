/**
 * meta_all_emojis / federation/stats / emoji-stats 用の MATERIALIZED VIEW を 4 本作成する。
 *
 * - mv_emoji_remote_snapshot: リモート絵文字スナップショット（name, host, sensitive, copyPermission）
 * - mv_federation_top_by_followers: 連合トップ（followersCount > 0）
 * - mv_federation_top_by_following: 連合トップ（followingCount > 0）
 * - mv_emoji_stats_recently_sent_local_no_bots: 直近14日・Bot除外・ローカル絵文字のみ・上位120件
 */
export class StatsMaterializedViews1740500000000 {
	name = "StatsMaterializedViews1740500000000";

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE MATERIALIZED VIEW mv_emoji_remote_snapshot AS
			SELECT name, host, sensitive, "copyPermission"
			FROM emoji
			WHERE "oldEmoji" = false AND host IS NOT NULL
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX idx_mv_emoji_remote_snapshot_name_host
			ON mv_emoji_remote_snapshot(name, host)
		`);

		await queryRunner.query(`
			CREATE MATERIALIZED VIEW mv_federation_top_by_followers AS
			SELECT * FROM instance WHERE "followersCount" > 0
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX idx_mv_federation_top_by_followers_id
			ON mv_federation_top_by_followers(id)
		`);

		await queryRunner.query(`
			CREATE MATERIALIZED VIEW mv_federation_top_by_following AS
			SELECT * FROM instance WHERE "followingCount" > 0
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX idx_mv_federation_top_by_following_id
			ON mv_federation_top_by_following(id)
		`);

		await queryRunner.query(`
			CREATE MATERIALIZED VIEW mv_emoji_stats_recently_sent_local_no_bots AS
			SELECT name, count FROM (
				SELECT r.reaction AS name, COUNT(*)::integer AS count
				FROM note_reaction r
				INNER JOIN "user" u ON r."userId" = u.id
				WHERE r."createdAt" >= (NOW() AT TIME ZONE 'UTC' - INTERVAL '14 days')
				  AND u."isBot" = FALSE
				  AND r.reaction ~ '^:[^@]+:$'
				GROUP BY r.reaction
				ORDER BY count DESC
				LIMIT 120
			) sub
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX idx_mv_emoji_stats_recently_sent_local_no_bots_name
			ON mv_emoji_stats_recently_sent_local_no_bots(name)
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP MATERIALIZED VIEW IF EXISTS mv_emoji_stats_recently_sent_local_no_bots`,
		);
		await queryRunner.query(
			`DROP MATERIALIZED VIEW IF EXISTS mv_federation_top_by_following`,
		);
		await queryRunner.query(
			`DROP MATERIALIZED VIEW IF EXISTS mv_federation_top_by_followers`,
		);
		await queryRunner.query(
			`DROP MATERIALIZED VIEW IF EXISTS mv_emoji_remote_snapshot`,
		);
	}
}
