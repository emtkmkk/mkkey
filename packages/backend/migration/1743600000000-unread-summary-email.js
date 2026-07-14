/**
 * 未読通知サマリーメール用のカラムを追加する。
 *
 * @remarks
 * - `user.unreadSummaryEmailSentAt`: 前回サマリーメールの集計基準時刻（送信成功時にセット）。
 *   null は「一度も送っていない」を表し、初回は未読全部が集計対象になる。
 * - `user_profile.receiveUnreadSummaryEmail`: サマリーメールの受信可否。
 *   既定 true（休眠中の既存ユーザーにも届くようにするため）。
 */
export class unreadSummaryEmail1743600000000 {
	constructor() {
		this.name = "unreadSummaryEmail1743600000000";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "unreadSummaryEmailSentAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD "receiveUnreadSummaryEmail" boolean NOT NULL DEFAULT true`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP COLUMN "receiveUnreadSummaryEmail"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "unreadSummaryEmailSentAt"`,
		);
	}
}
