/**
 * フォロー解除・ブロック関連の通知種別を enum に追加し、既存ユーザーをデフォルトミュートにする。
 */
export class addUnfollowAndBlockNotifications1743000000000 {
	name = "addUnfollowAndBlockNotifications1743000000000";

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
