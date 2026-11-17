/**
 * user にお遊び機能「マクドナルドの短縮名」の設定（mcShortName）を追加する。
 *
 * @remarks
 * - 既存のユーザーは null（未設定。短縮名は「マック」）。
 * - null 許可・既定値なしの列追加なので、テーブルを書き換えず一瞬で終わる。
 * - down は列を消すだけ。各ユーザーの設定は失われるが、本文は `$[mc]` のまま保存しているので投稿は壊れない。
 *
 * @internal
 */
export class UserMcShortName1791417600000 {
	name = "UserMcShortName1791417600000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mcShortName" character varying(16)`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."mcShortName" IS 'Short name of McDonald''s used for $[mc] in notes: makku / makudo / free:xxxxxx (null = makku).'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN IF EXISTS "mcShortName"`,
		);
	}
}
