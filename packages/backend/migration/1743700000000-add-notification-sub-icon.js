export class addNotificationSubIcon1743700000000 {
	constructor() {
		this.name = "addNotificationSubIcon1743700000000";
	}
	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "notification" ADD "customSubIcon" character varying(1024)`,
			undefined,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "notification"."customSubIcon" IS 'アプリ通知のサブアイコン（絵文字または画像 URL）'`,
			undefined,
		);
	}
	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "notification" DROP COLUMN "customSubIcon"`,
			undefined,
		);
	}
}
