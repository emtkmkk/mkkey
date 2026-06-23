/**
 * 既存の `followedAccountWasDeleted` 通知に表示名スナップショットをバックフィルする。
 *
 * @remarks
 * - `customBody` が未設定の通知のみ対象。
 * - フォロワーごとのユーザーメモ（customName）を優先し、なければ削除ユーザーの name / username を使う。
 */
export class backfillFollowedDeletedNotificationNames1743200000000 {
	constructor() {
		this.name = "backfillFollowedDeletedNotificationNames1743200000000";
	}

	async up(queryRunner) {
		await queryRunner.query(`
			UPDATE notification n
			SET "customBody" = COALESCE(m."customName", u.name, u.username)
			FROM "user" u
			LEFT JOIN user_memo m
				ON m."userId" = n."notifieeId" AND m."targetUserId" = n."notifierId"
			WHERE n.type = 'followedAccountWasDeleted'
				AND n."customBody" IS NULL
				AND n."notifierId" = u.id
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			UPDATE notification
			SET "customBody" = NULL
			WHERE type = 'followedAccountWasDeleted'
		`);
	}
}
