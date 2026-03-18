/**
 * user_profile に pinnedAge カラムを追加するマイグレーション。
 * プロフィール年齢固定機能：ユーザーがトグルで年齢を固定した場合に保存する（6-122の範囲外や未設定はnull）。
 * ローカルユーザーには、既存の名前・自己紹介からの年齢判定（○歳/○yo/○sai）で初期値を設定する。
 */
export class AddPinnedAge1741100000000 {
	name = "AddPinnedAge1741100000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "pinnedAge" smallint`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."pinnedAge" IS 'ユーザーが固定した年齢（6-122の範囲外や未設定はnull）'`,
		);

		// ローカルユーザーだけ、既存条件（名前・説明の ○歳/○yo/○sai）で初期 pinnedAge を設定
		const rows = await queryRunner.query(
			`SELECT up."userId", u.name, up.description
			 FROM "user_profile" up
			 INNER JOIN "user" u ON u.id = up."userId"
			 WHERE up."userHost" IS NULL`,
		);
		const cancelRe = /(\d{1,2})(yo|歳|sai)([以未])/;
		const extractRe = /(\d{1,2})(yo|歳|sai)([^以未]|$)/;
		for (const row of rows) {
			const name = row.name ?? "";
			const description = row.description ?? "";
			if (cancelRe.test(name) || cancelRe.test(description)) continue;
			if (!extractRe.test(name) && !extractRe.test(description)) continue;
			const fromName = extractRe.exec(name)?.[1];
			const fromDesc = extractRe.exec(description)?.[1];
			const dyear = fromName ?? fromDesc;
			if (dyear == null) continue;
			const age = parseInt(dyear, 10);
			if (Number.isNaN(age) || age < 6 || age > 122) continue;
			await queryRunner.connection
				.createQueryBuilder()
				.update("user_profile")
				.set({ pinnedAge: age })
				.where('"userId" = :id', { id: row.userId })
				.execute();
		}
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "pinnedAge"`,
		);
	}
}
