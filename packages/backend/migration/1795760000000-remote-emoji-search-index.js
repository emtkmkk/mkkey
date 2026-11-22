/**
 * 他鯖絵文字をサーバーで検索するための関数と部分インデックスを追加する。
 *
 * - `mk_emoji_search_key(name)`: 絵文字名を検索用の形にする。クライアントの `formatRoomaji`
 *   （packages/client/src/scripts/convert-jp.ts の format_roomaji）と同じ変換をする。
 *   「shi」と「si」、「_」の有無などを同じ物として扱うため。
 *   WARNING: クライアントの format_roomaji の変換表を変えたら、この関数も同じ順番で直すこと。
 *   ずれると、端末の辞書で見つかる絵文字がサーバー検索で見つからなくなる。
 *   直すときは新しいマイグレーションで関数を作り直し、インデックスも作り直す（REINDEX）。
 * - 他鯖絵文字（host IS NOT NULL かつ oldEmoji = false）だけを対象にした部分インデックスを 3 つ作る。
 *   - 部分一致用: 検索用の名前への trigram の GIN
 *   - 前方一致用: 検索用の名前への text_pattern_ops の btree
 *   - エイリアスの完全一致用: aliases への GIN
 * - 本番では絵文字の受信を止めないよう CONCURRENTLY で作る（そのため transaction = false）。
 *   本番は 27 万行ほどで、作成は数秒〜十数秒。
 * - pg_trgm は PostgreSQL 13 以降で trusted な拡張なので、DB の CREATE 権限があれば作れる。
 */
export class RemoteEmojiSearchIndex1795760000000 {
	name = "RemoteEmojiSearchIndex1795760000000";

	constructor() {
		this.transaction = false;
	}

	async up(queryRunner) {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

		// format_roomaji と同じ順番で置き換える。
		// 元の名前が 3 文字以上なら 3 文字の規則を先に、2 文字以上なら 2 文字の規則を後に当てる。
		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION mk_emoji_search_key(src text) RETURNS text
			LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
				SELECT CASE WHEN length(src) >= 2 THEN
					replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
					replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
					replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
					replace(
						s3,
					'ca','ka'),'ci','ki'),'cu','ku'),'ce','ke'),'co','ko'),'fu','hu'),
					'za','jya'),'zi','jyi'),'zu','jyu'),'ze','jye'),'zo','jyo'),
					'ja','jya'),'ju','jyu'),'je','jye'),'jo','jyo'),
					'fa','fya'),'fi','fyi'),'fe','fye'),'fu','fyu'),'fo','fyo'),
					'la','xa'),'li','xi'),'lu','xu'),'le','xe'),'lo','xo'),
					'va','ba'),'vi','bi'),'vu','bu'),'ve','be'),'vo','bo'),
					'_','')
				ELSE s3 END
				FROM (
					SELECT CASE WHEN length(src) >= 3 THEN
						replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
						replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
							lower(src),
						'sha','sya'),'shi','si'),'shu','syu'),'sho','syo'),'syi','si'),
						'chi','ti'),'thi','ti'),'tsu','tu'),'kwa','kya'),
						'cya','tya'),'cyi','tyi'),'cyu','tyu'),'cye','tye'),'cyo','tyo'),
						'jya','zya'),'jyi','zyi'),'jyu','zyu'),'jye','zye'),'jyo','zyo'),
						'ltu','xtu')
					ELSE lower(src) END AS s3
				) t
			$$
		`);

		await queryRunner.query(`
			CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_emoji_remote_search_key_trgm"
			ON "emoji" USING gin (mk_emoji_search_key("name") gin_trgm_ops)
			WHERE "host" IS NOT NULL AND "oldEmoji" = false
		`);
		await queryRunner.query(`
			CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_emoji_remote_search_key_prefix"
			ON "emoji" (mk_emoji_search_key("name") text_pattern_ops)
			WHERE "host" IS NOT NULL AND "oldEmoji" = false
		`);
		await queryRunner.query(`
			CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_emoji_remote_aliases"
			ON "emoji" USING gin ("aliases")
			WHERE "host" IS NOT NULL AND "oldEmoji" = false
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX CONCURRENTLY IF EXISTS "IDX_emoji_remote_aliases"`,
		);
		await queryRunner.query(
			`DROP INDEX CONCURRENTLY IF EXISTS "IDX_emoji_remote_search_key_prefix"`,
		);
		await queryRunner.query(
			`DROP INDEX CONCURRENTLY IF EXISTS "IDX_emoji_remote_search_key_trgm"`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS mk_emoji_search_key(text)`);
		// NB: pg_trgm は他でも使うことがあるので消さない
	}
}
