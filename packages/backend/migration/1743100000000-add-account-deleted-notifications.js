/**
 * フォロー関係のアカウント削除通知種別を enum に追加する（デフォルト ON のため muting には追加しない）。
 *
 * @remarks
 * - enum 追加は `transaction = false` とし、他マイグレーションと同様に 55P04 を避ける。
 */
export class addAccountDeletedNotifications1743100000000 {
	constructor() {
		this.name = "addAccountDeletedNotifications1743100000000";
		this.transaction = false;
	}

	async up(queryRunner) {
		const newTypes = ["followedAccountWasDeleted"];

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
		for (const type of ["followedAccountWasDeleted"]) {
			await queryRunner.query(
				`UPDATE user_profile SET "mutingNotificationTypes" = array_remove("mutingNotificationTypes", '${type}')`,
			);
		}
	}
}
