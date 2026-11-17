/**
 * note にセミパブリック（ローカルではホーム、リモートには公開）を表す semiPublic 列を追加する。
 *
 * @remarks
 * - 既存の投稿はすべて false（従来どおり）。
 * - NOT NULL + 定数 DEFAULT の列追加は PostgreSQL 11 以降ではテーブルを書き換えないので、
 *   巨大な note テーブルでも一瞬で終わる。
 * - down は列を消すだけ。セミパブリックで投稿したノートは、ローカルでは元からホームなので
 *   列が消えても表示は変わらない（以後の配送・取得でリモートからホーム扱いになるだけ）。
 *
 * @internal
 */
export class NoteSemiPublic1791331200000 {
	name = "NoteSemiPublic1791331200000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ADD COLUMN IF NOT EXISTS "semiPublic" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."semiPublic" IS 'Whether the note is home locally but delivered to remote servers as public.'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" DROP COLUMN IF EXISTS "semiPublic"`,
		);
	}
}
