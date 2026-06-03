/**
 * フォロー解除・ブロック関連の通知種別を enum に追加し、既存ユーザーをデフォルトミュートにする。
 *
 * @remarks
 * - PostgreSQL は `ALTER TYPE ... ADD VALUE` 直後、同一トランザクション内で新値を使えない（55P04）。
 * - enum 追加と UPDATE を別コミットにするため `transaction = false` とする。
 */
export class addUnfollowAndBlockNotifications1743000000000 {
	constructor() {
		this.name = "addUnfollowAndBlockNotifications1743000000000";
		this.transaction = false;
	}

	async up(queryRunner) {
		const newTypes = [
			"userWasUnfollowed",
			"wasForciblyUnfollowed",
			"wasBlocked",
		];

		for (const type of newTypes) {
			await queryRunner.query(
				`ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS '${type}'`,
			);
			await queryRunner.query(
				`ALTER TYPE user_profile_mutingnotificationtypes_enum ADD VALUE IF NOT EXISTS '${type}'`,
			);
		}

		await queryRunner.query(`
			UPDATE user_profile
			SET "mutingNotificationTypes" = (
				SELECT COALESCE(array_agg(DISTINCT e), '{}')
				FROM unnest(
					COALESCE("mutingNotificationTypes", '{}'::user_profile_mutingnotificationtypes_enum[])
					|| ARRAY['userWasUnfollowed','wasForciblyUnfollowed','wasBlocked']::user_profile_mutingnotificationtypes_enum[]
				) AS e
			)
		`);
	}

	async down(queryRunner) {
		for (const type of [
			"userWasUnfollowed",
			"wasForciblyUnfollowed",
			"wasBlocked",
		]) {
			await queryRunner.query(
				`UPDATE user_profile SET "mutingNotificationTypes" = array_remove("mutingNotificationTypes", '${type}')`,
			);
		}
	}
}
