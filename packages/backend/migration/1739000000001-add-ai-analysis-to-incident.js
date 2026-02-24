/**
 * performance_incident テーブルに AI 分析結果用カラムを追加するマイグレーション
 */
export class AddAiAnalysisToIncident1739000000001 {
	name = "AddAiAnalysisToIncident1739000000001";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "performance_incident" ADD "aiAnalysis" text`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "performance_incident" DROP COLUMN "aiAnalysis"`,
		);
	}
}
