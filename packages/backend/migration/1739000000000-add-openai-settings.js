/**
 * Meta テーブルに OpenAI 設定（パフォーマンスインシデントAI分析用）を追加するマイグレーション
 */
export class AddOpenaiSettings1739000000000 {
	name = "AddOpenaiSettings1739000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "openaiApiKey" character varying(256)`,
		);
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "openaiModel" character varying(64) DEFAULT 'gpt-4o-mini'`,
		);
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "openaiBaseUrl" character varying(512)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "openaiBaseUrl"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "openaiModel"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "openaiApiKey"`);
	}
}
