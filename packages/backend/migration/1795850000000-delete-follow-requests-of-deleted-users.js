/**
 * 削除済みアカウントが関わるフォロー申請（送った分・受けた分）を消す。
 *
 * - アカウント削除ジョブで申請を消すようにする前に削除されたアカウントの申請が残っているため、
 *   1 回だけ掃除する。以降の削除分は queue/processors/db/delete-account.ts が消す。
 * - `receiveFollowRequest` 通知は `followRequestId` に ON DELETE CASCADE で紐づくため、
 *   申請を消すとその通知も一緒に消える。
 * - NB: 未処理の申請数は表示のたびに数え直すので、ここで別に更新するものはない。
 * - down では元に戻せない（消した行は復元できない）ため何もしない。
 */
export class DeleteFollowRequestsOfDeletedUsers1795850000000 {
	name = "DeleteFollowRequestsOfDeletedUsers1795850000000";

	async up(queryRunner) {
		await queryRunner.query(`
			DELETE FROM "follow_request" fr
			USING "user" u
			WHERE u."isDeleted" = true
				AND (fr."followerId" = u."id" OR fr."followeeId" = u."id")
		`);
	}

	async down() {
		// 消した申請は復元できないため何もしない
	}
}
