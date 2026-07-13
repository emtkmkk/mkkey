/**
 * 休眠アカウント自動削除の予告メール送信時刻カラムを追加する。
 *
 * @remarks
 * - `inactiveDeletionWarnedAt` が null のときのみ警告メール対象（同一休眠サイクルで1回限り）。
 * - 再ログイン時に null へ戻す想定。
 */
export class userInactiveDeletionWarnedAt1743400000000 {
	constructor() {
		this.name = "userInactiveDeletionWarnedAt1743400000000";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "inactiveDeletionWarnedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "inactiveDeletionWarnedAt"`,
		);
	}
}
