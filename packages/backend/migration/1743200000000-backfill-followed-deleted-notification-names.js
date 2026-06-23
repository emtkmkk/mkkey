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
		// NOTE: UPDATE 対象の別名は FROM 内の JOIN 条件で参照できないためサブクエリで結合する
		await queryRunner.query(`
			UPDATE notification n
			SET "customBody" = src.display_name
			FROM (
				SELECT
					n2.id,
					COALESCE(m."customName", u.name, u.username) AS display_name
				FROM notification n2
				INNER JOIN "user" u ON n2."notifierId" = u.id
				LEFT JOIN user_memo m
					ON m."userId" = n2."notifieeId"
					AND m."targetUserId" = n2."notifierId"
				WHERE n2.type = 'followedAccountWasDeleted'
					AND n2."customBody" IS NULL
			) src
			WHERE n.id = src.id
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
