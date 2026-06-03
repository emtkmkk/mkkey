/**
 * ブロック解除通知種別 wasUnblocked を enum に追加する。
 *
 * @remarks
 * - デフォルトミュートの一括 UPDATE は行わない（wasBlocked 設定連動で制御）。
 * - enum 追加は `transaction = false` とし、55P04 を避ける。
 */
export class addWasUnblockedNotification1743200000000 {
	constructor() {
		this.name = "addWasUnblockedNotification1743200000000";
		this.transaction = false;
	}

	async up(queryRunner) {
		const newTypes = ["wasUnblocked"];

		for (const type of newTypes) {
			await queryRunner.query(
				`ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS '${type}'`,
			);
			await queryRunner.query(
				`ALTER TYPE user_profile_mutingnotificationtypes_enum ADD VALUE IF NOT EXISTS '${type}'`,
			);
		}
	}

	async down(queryRunner) {
		await queryRunner.query(
			`UPDATE user_profile SET "mutingNotificationTypes" = array_remove("mutingNotificationTypes", 'wasUnblocked')`,
		);
	}
}
