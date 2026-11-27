/**
 * @packageDocumentation
 *
 * 予約されたアカウント削除を実行する system ジョブ（日本時間 2:00 と、サーバーの起動時）。
 *
 * @remarks
 * - 予定日時（`scheduledAt`）を過ぎた予約を 1 件ずつ、既存のアカウント削除（services/delete-account.ts）に通す。
 * - 2:00 に動かなかったとき（サーバーが止まっていたなど）の分は、次の回か起動時の回でまとめて拾う。
 * - 判断の軸「取り違えて消さない」のため、削除の直前に、予約がまだ有効で予定日時を過ぎているかを
 *   条件付きの UPDATE で確かめながら取る（同時に 2 つ動いても、1 件を 2 回削除しない）。
 * - 削除が途中で失敗したら予約を元に戻し、次の回でもう一度試す。
 *
 * @see {@link services/account-deletion-schedule} 予約
 * @internal
 */
import type Bull from "bull";
import { LessThanOrEqual } from "typeorm";
import { AccountDeletionSchedules, Users } from "@/models/index.js";
import { deleteAccount } from "@/services/delete-account.js";
import { afterAccountDeletionScheduleChanged } from "@/services/account-deletion-schedule.js";
import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("execute-scheduled-account-deletions");

/**
 * 予定日時を過ぎたアカウント削除の予約を実行する。
 *
 * @param job - Bull ジョブ
 * @returns 結果の要約（ジョブの記録に残る）
 * @internal
 */
export async function executeScheduledAccountDeletions(
	job: Bull.Job<Record<string, unknown>>,
): Promise<string> {
	const now = new Date();
	const due = await AccountDeletionSchedules.find({
		where: { scheduledAt: LessThanOrEqual(now) },
		order: { scheduledAt: "ASC" },
	});
	if (due.length === 0) return "no scheduled deletions";

	let deleted = 0;
	let skipped = 0;
	let failed = 0;

	for (const row of due) {
		// まだ予約中で予定日時を過ぎているものだけを取る（取ったら予約を空にする）
		const claim = await AccountDeletionSchedules.createQueryBuilder()
			.update()
			.set({ scheduledAt: null, executedAt: now })
			.where('"userId" = :userId AND "scheduledAt" IS NOT NULL AND "scheduledAt" <= :now', {
				userId: row.userId,
				now,
			})
			.execute();
		if (!claim.affected) {
			skipped += 1;
			continue;
		}

		const user = await Users.findOneBy({ id: row.userId });
		if (user == null || user.host != null || user.isDeleted) {
			// 管理者がすぐに削除したなど、もう消すものが無い
			logger.info(`Skip scheduled deletion (already gone): ${row.userId}`);
			skipped += 1;
			await afterAccountDeletionScheduleChanged(row.userId);
			continue;
		}

		try {
			logger.info(`Executing scheduled account deletion: ${user.id} @${user.username}`);
			job.log(`info - Executing scheduled account deletion: ${user.id}`);
			await deleteAccount(user);
			deleted += 1;
		} catch (err) {
			// 予約を元に戻して、次の回でもう一度試す
			logger.error(err as Error);
			job.log(`error - Failed to delete ${user.id}: ${String(err)}`);
			await AccountDeletionSchedules.update(row.userId, {
				scheduledAt: row.scheduledAt,
				executedAt: null,
			});
			failed += 1;
		}
		await afterAccountDeletionScheduleChanged(row.userId);
	}

	const summary = `deleted=${deleted} skipped=${skipped} failed=${failed}`;
	logger.succ(`Scheduled account deletions done: ${summary}`);
	return summary;
}
