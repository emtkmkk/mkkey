/**
 * 既存のブロック関係に対応する all ミュートが無い行を補完する。
 *
 * @remarks
 * - TL 非表示はミュート依存のため、インポート等でブロックのみ作られた行を直す。
 * - 既に muting があるが all ビットが無い場合は無期限 all に揃える（blocking/create と同方針）。
 * - 管理人は API 上ブロック不可のため、管理人向けの除外は行わない。
 */
export class BackfillAllMuteForExistingBlocks1753400000000 {
	name = "BackfillAllMuteForExistingBlocks1753400000000";

	async up(queryRunner) {
		// ブロックあり・ミュート無し → all(1) を挿入（blocking.id を muting.id に流用）
		await queryRunner.query(`
			INSERT INTO "muting" ("id", "createdAt", "expiresAt", "muteeId", "muterId", "scope")
			SELECT b."id", b."createdAt", NULL, b."blockeeId", b."blockerId", 1
			FROM "blocking" b
			WHERE EXISTS (SELECT 1 FROM "user" u WHERE u."id" = b."blockerId")
				AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = b."blockeeId")
				AND NOT EXISTS (
					SELECT 1 FROM "muting" m
					WHERE m."muterId" = b."blockerId" AND m."muteeId" = b."blockeeId"
				)
			ON CONFLICT ("muterId", "muteeId") DO NOTHING
		`);

		// ブロックあり・個別範囲のみ → 無期限 all に揃える
		await queryRunner.query(`
			UPDATE "muting" m
			SET "scope" = 1, "expiresAt" = NULL
			FROM "blocking" b
			WHERE m."muterId" = b."blockerId"
				AND m."muteeId" = b."blockeeId"
				AND (m."scope" & 1) = 0
		`);
	}

	async down() {
		// 補完で入れたミュートと、利用者が手動で付けたミュートを区別できないためロールバックしない
	}
}
