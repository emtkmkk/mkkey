/**
 * @packageDocumentation
 *
 * アカウント削除キュー。フォロー・ノート・ドライブ・プロフィール等を削除する。
 *
 * @remarks
 * - **役割**: アカウント削除キューで実行し、ユーザーに紐づくデータを順次削除する。
 * - フォロー解除は原則 `silent`。削除ユーザーがフォローしていた相手のうち、
 *   **フォロー返しがない**ローカルユーザーには `userWasUnfollowed` を送る。
 * - 削除ユーザーをフォローしていたローカルユーザーへの `followedAccountWasDeleted` は
 *   `isDeleted` 更新前に API 側で送る（{@link notifyFollowersAccountWasDeleted}）。
 *   相互フォローでもフォロー先削除通知だけとし、フォロー解除通知は重ねない。
 *
 * @see {@link server/api/endpoints/i/delete-account} アカウント削除 API
 * @internal
 */
import type Bull from "bull";
import { queueLogger } from "../../logger.js";
import deleteNote from "@/services/note/delete.js";
import {
	Followings,
	DriveFiles,
	Notes,
	UserProfiles,
	Users,
} from "@/models/index.js";
import type { DbUserDeleteJobData } from "@/queue/types.js";
import type { Note } from "@/models/entities/note.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { IsNull, MoreThan } from "typeorm";
import { deleteFileSync } from "@/services/drive/delete-file.js";
import { buildGuidanceEmail, sendEmail } from "@/services/send-email.js";
import deleteFollowing from "@/services/following/delete.js";
import { createNotification } from "@/services/create-notification.js";
import { getUser } from "@/server/api/common/getters.js";

const logger = queueLogger.createSubLogger("delete-account");

export async function deleteAccount(
	job: Bull.Job<DbUserDeleteJobData>,
): Promise<string | void> {
	const user = await Users.findOneBy({ id: job.data.user.id });
	if (user == null) {
		return;
	}

	logger.info(
		`Deleting account of ${job.data.user.id} @${user.username}${
			user.host ? `@${user.host}` : ""
		} ...`,
	);
	job.log("info - " +
		`Deleting account of ${job.data.user.id} @${user.username}${
			user.host ? `@${user.host}` : ""
		} ...`,
	);

	// 削除前に followedAccountWasDeleted を送ったローカルユーザー（相互フォロー判定用）
	const followedDeletedNotified = new Set<string>(
		job.data.followedDeletedNotifiedIds ?? [],
	);

	try {
		let tryCount = 0;
		let deleteCount = 0;
		const total = await Followings.countBy({
			followeeId: user.id,
		});
		while (tryCount <= 100) {
			const relations = await Followings.find({
				where: {
					followeeId: user.id,
				},
				take: 100,
			});

			if (relations.length === 0) {
				break;
			}

			for (const x of relations) {
				try {
					const follower = await getUser(x.followerId);
					if (follower) {
						// followedAccountWasDeleted は isDeleted 更新前に API 側で送済み
						await deleteFollowing(follower, user, true);
						deleteCount += 1;
					}
					tryCount = 0;
				} catch {}
			}
			tryCount += 1;
			job.progress(25 + (+(deleteCount / total * 25).toFixed(1)))
		}
		job.progress(50)
		if (deleteCount) logger.succ(`All of followers deleted (${deleteCount})`);
	} catch {}

	{
		let deleteCount = 0;
		let failedCount = 0;
		// Delete notes
		let cursor: Note["id"] | null = null;

		const total = await Notes.countBy({
					userId: user.id,
					deletedAt: IsNull(),
					...(cursor ? { id: MoreThan(cursor) } : {}),
		});

		while (true) {
			const notes = (await Notes.find({
				where: {
					userId: user.id,
					deletedAt: IsNull(),
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			})) as Note[];

			if (notes.length === 0) {
				break;
			}

			cursor = notes[notes.length - 1].id;

			for (const note of notes) {
				try {
					await deleteNote(user, note, false, false);
					deleteCount += 1;
				} catch {
					failedCount += 1;
				}
			}
			job.progress(0 + (+((deleteCount + failedCount) / total * 50).toFixed(1)))
			logger.info(
				`Notes deleting... (Total: ${deleteCount}${
					failedCount ? ` / ${failedCount}` : ""
				})`,
			);
			job.log("info - " +
				`Notes deleting... (Total: ${deleteCount}${
					failedCount ? ` / ${failedCount}` : ""
				})`,
			);
		}

		job.progress(50)
		if (deleteCount + failedCount)
			logger.succ(
				`All of notes deleted (${deleteCount}${
					failedCount ? ` / ${failedCount}` : ""
				})`,
			);
			job.log("succ - " +
				`All of notes deleted (${deleteCount}${
					failedCount ? ` / ${failedCount}` : ""
				})`,
			);
	}

	{
		let deleteCount = 0;
		// Delete files
		let cursor: DriveFile["id"] | null = null;

		const total = await DriveFiles.countBy({
			userId: user.id,
		});

		while (true) {
			const files = (await DriveFiles.find({
				where: {
					userId: user.id,
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 10,
				order: {
					id: 1,
				},
			})) as DriveFile[];

			if (files.length === 0) {
				break;
			}

			cursor = files[files.length - 1].id;

			for (const file of files) {
				deleteCount += 1;
				await deleteFileSync(file);
			}
		}

		job.progress(50 + (+(deleteCount / total * 24.9).toFixed(1)))
		if (deleteCount) logger.succ(`All of files deleted (${deleteCount})`);
	}

	try {
		let tryCount = 0;
		let deleteCount = 0;

		const total = await Followings.countBy({
				followerId: user.id,
		});

		while (tryCount <= 100) {
			const relations = await Followings.find({
				where: {
					followerId: user.id,
				},
				take: 100,
			});

			if (relations.length === 0) {
				break;
			}

			for (const x of relations) {
				try {
					const followee = await getUser(x.followeeId);
					if (followee) {
						// ループ1相当でフォロー先削除通知済みならフォロー解除通知は出さない
						if (
							Users.isLocalUser(followee) &&
							!followedDeletedNotified.has(followee.id)
						) {
							// ジョブ実行時点では isDeleted=true のため、表示用に削除前状態を渡す
							const notifierBeforeDeletion = { ...user, isDeleted: false };
							void createNotification(
								followee.id,
								"userWasUnfollowed",
								{ notifierId: user.id },
								{ notifier: notifierBeforeDeletion },
							);
						}
						await deleteFollowing(user, followee, true);
						deleteCount += 1;
					}
					tryCount = 0;
				} catch {}
			}
			tryCount += 1;
			job.progress(+(deleteCount / total * 25).toFixed(1))
		}
		if (deleteCount) logger.succ(`All of followees deleted (${deleteCount})`);
	} catch {}

	job.progress(99.9)

	{
		// Send email notification
		const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
		if (profile.email && profile.emailVerified) {
			// NOTE: メール送信失敗で削除ジョブ全体を失敗させない
			try {
				const mail = await buildGuidanceEmail({
					subjectBody: "アカウント削除完了のご案内",
					recipientUsername: user.username,
					greeting: "plain",
					paragraphs: [
						`ご利用のアカウント（@${user.username}）の削除処理が完了いたしましたので、お知らせいたします。`,
					],
					closing:
						"これまで{serverName}をご利用いただき、誠にありがとうございました。",
				});
				await sendEmail(profile.email, mail.subject, mail.html, mail.text);
				logger.succ("Email sent completed");
				job.log("succ - " + "Email sent completed");
			} catch (err) {
				logger.error(err as Error);
				job.log(`error - Failed to send email: ${String(err)}`);
			}
		}
	}

	// soft指定されている場合は物理削除しない
	if (job.data.soft) {
		// nop
	} else {
		// await Users.delete(job.data.user.id);
	}
	job.progress(100)
	logger.succ(
		`Finish deleting job ${job.data.user.id} @${user.username}${
			user.host ? `@${user.host}` : ""
		}`,
	);
	job.log("succ - " +
		`Finish deleting job ${job.data.user.id} @${user.username}${
			user.host ? `@${user.host}` : ""
		}`,
	);

	return "Account deleted";
}
