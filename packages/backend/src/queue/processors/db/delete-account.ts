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
 * - 削除ユーザーが出した・受けたフォロー申請は、承認しても意味がないため最初に取り消す
 *   （{@link cancelFollowRequestsOfDeletedUser}）。ローカルの削除では Delete 送信前に
 *   API 側で取り消し済みなので、ここは念のための掃除になる。リモートの削除はここだけを通る。
 *   `receiveFollowRequest` 通知は申請に CASCADE で紐づくので、申請と一緒に消える。
 *   それ以外の通知（リアクション等）は意味が残るため消さない。
 * - 投稿は 100 件ずつまとめて消す（{@link deleteNotesOfDeletedAccount}）。抜け殻を残す決まりは
 *   1 件ずつの削除と同じ。投稿ごとの Delete は送らない。相手のサーバーで投稿を消してもらうのは、
 *   ユーザーの Delete（知っているすべてのサーバーと外部のリレーへ送る）と、取りに来たときの送り直しに任せる。
 *   NB: 以前は投稿ごとに Delete を送っていたが、先にフォロワーを外しているためフォロワーには届いておらず、
 *   リレーとメンション先にだけ、投稿の数だけ送っていた。
 * - ローカルのアカウント削除では、投稿のメンション先・返信先・リノート先と、投稿を RT・返信してきた人の
 *   サーバーにも、ユーザーの Delete を 1 回ずつ送る（{@link deliverDeleteToConcernedServers}）。
 *   ユーザーの Delete の送り先はフォロー関係から作るので、メンションや RT でだけ関わったサーバーには届かないため。
 *   NB: RT してきた人のフォロワーのサーバーは、こちらからは分からない。取りに来たときの送り直しに任せる。
 *
 * @see {@link server/api/endpoints/i/delete-account} アカウント削除 API
 * @internal
 */
import type Bull from "bull";
import { queueLogger } from "../../logger.js";
import { deleteNotesOfDeletedAccount } from "@/services/note/delete.js";
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
import { In, IsNull, MoreThan } from "typeorm";
import type { ILocalUser } from "@/models/entities/user.js";
import config from "@/config/index.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderDelete from "@/remote/activitypub/renderer/delete.js";
import { deliver } from "@/queue/index.js";
import { deleteFileSync } from "@/services/drive/delete-file.js";
import { buildGuidanceEmail, sendEmail } from "@/services/send-email.js";
import deleteFollowing from "@/services/following/delete.js";
import { createNotification } from "@/services/create-notification.js";
import { getUser } from "@/server/api/common/getters.js";
import { cancelFollowRequestsOfDeletedUser } from "@/services/following/requests/cancel-for-deleted-user.js";

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

	// NOTE: 失敗しても後続の削除処理は続ける（申請が残るだけで実害は小さい）
	try {
		const deleted = await cancelFollowRequestsOfDeletedUser(user);
		if (deleted) logger.succ(`All of follow requests deleted (${deleted})`);
	} catch (err) {
		logger.error(err as Error);
		job.log(`error - Failed to delete follow requests: ${String(err)}`);
	}

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
				} catch (err) {
					// NOTE: 以前は黙って握り潰していたため、消せずに残ったフォロー関係の原因が追えなかった。
					// 失敗した行は次の周でも取り直され、100 周続けて進まなければあきらめる
					logger.warn(`Failed to delete following ($follower) ${x.id}: ${err}`);
					job.log(`warn - Failed to delete following ($follower) ${x.id}: ${String(err)}`);
				}
			}
			tryCount += 1;
			job.progress(25 + (+(deleteCount / total * 25).toFixed(1)))
		}
		job.progress(50)
		if (deleteCount) logger.succ(`All of followers deleted (${deleteCount})`);
	} catch (err) {
		logger.error(err as Error);
		job.log(`error - Failed to delete followers: ${String(err)}`);
	}

	{
		let deleteCount = 0;
		let failedCount = 0;
		// Delete notes
		let cursor: Note["id"] | null = null;
		// メンション先・返信先・リノート先と、RT・返信してきたリモートユーザー（抜け殻にするとメンションの情報が消えるので、消す前に集める）
		const concerned = { uris: new Set<string>(), userIds: new Set<string>() };

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

			if (Users.isLocalUser(user)) {
				await collectConcernedRemoteUsers(notes, concerned).catch((err) =>
					logger.warn(`Failed to collect mentioned servers: ${err}`),
				);
			}

			try {
				// 100 件をまとめて消す（投稿ごとの Delete は送らない。理由は deleteNotesOfDeletedAccount 参照）
				await deleteNotesOfDeletedAccount(user, notes);
				deleteCount += notes.length;
			} catch (err) {
				// まとめて失敗したら 1 件ずつやり直し、失敗した投稿だけ飛ばす
				logger.warn(`Failed to delete notes in batch, retrying one by one: ${err}`);
				for (const note of notes) {
					try {
						await deleteNotesOfDeletedAccount(user, [note]);
						deleteCount += 1;
					} catch (e) {
						failedCount += 1;
						logger.warn(`Failed to delete note ${note.id}: ${e}`);
					}
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

		if (Users.isLocalUser(user)) {
			try {
				const sent = await deliverDeleteToConcernedServers(user, concerned);
				if (sent) logger.succ(`Delete sent to mentioned servers (${sent})`);
			} catch (err) {
				logger.warn(`Failed to send Delete to mentioned servers: ${err}`);
			}
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
				} catch (err) {
					// NOTE: 以前は黙って握り潰していたため、消せずに残ったフォロー関係の原因が追えなかった。
					// 失敗した行は次の周でも取り直され、100 周続けて進まなければあきらめる
					logger.warn(`Failed to delete following ($followee) ${x.id}: ${err}`);
					job.log(`warn - Failed to delete following ($followee) ${x.id}: ${String(err)}`);
				}
			}
			tryCount += 1;
			job.progress(+(deleteCount / total * 25).toFixed(1))
		}
		if (deleteCount) logger.succ(`All of followees deleted (${deleteCount})`);
	} catch (err) {
		logger.error(err as Error);
		job.log(`error - Failed to delete followees: ${String(err)}`);
	}

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

/**
 * 投稿に関わったリモートのユーザーを集める（あとでユーザーの Delete を送るため）。
 *
 * @param notes - これから消す投稿（消す前の内容）
 * @param concerned - 集めた先。`uris` はメンション先の URI、`userIds` はそれ以外のユーザー ID
 * @returns 集め終わった時点で解決する Promise
 *
 * @remarks
 * - 消す人から相手へ: メンション先・返信先・リノート先（引用を含む）の投稿の作者。
 *   1 件ずつの削除が投稿ごとの Delete を送っていた相手（services/note/delete.ts の getMentionedRemoteUsers）に、
 *   返信先の作者を足したもの。返信はふつう相手へのメンションを含むが、念のため。
 * - 相手から消す人へ: 消す投稿を RT・引用・返信してきたリモートの投稿の作者。
 *   そのサーバーは投稿の写しを持っているが、フォロー関係が無ければユーザーの Delete が届かないため。
 *   `renoteId` と `replyId` のインデックスを使う、束ごとに 1 回の問い合わせ。
 *
 * @internal
 */
async function collectConcernedRemoteUsers(
	notes: Note[],
	concerned: { uris: Set<string>; userIds: Set<string> },
): Promise<void> {
	for (const note of notes) {
		try {
			const mentioned = JSON.parse(note.mentionedRemoteUsers) as { uri: string }[];
			for (const x of mentioned) if (x.uri) concerned.uris.add(x.uri);
		} catch {
			// 壊れた値は飛ばす（宛先が 1 つ減るだけ）
		}
		if (note.renoteUserId) concerned.userIds.add(note.renoteUserId);
		if (note.replyUserId) concerned.userIds.add(note.replyUserId);
	}

	if (notes.length === 0) return;
	const reacted: { userId: string }[] = await Notes.createQueryBuilder("note")
		.select('DISTINCT "note"."userId"', "userId")
		.where(
			'("note"."renoteId" IN (:...ids) OR "note"."replyId" IN (:...ids))',
			{ ids: notes.map((note) => note.id) },
		)
		.andWhere('"note"."userHost" IS NOT NULL')
		.getRawMany();
	for (const x of reacted) concerned.userIds.add(x.userId);
}

/**
 * 投稿に関わったリモートのユーザーのサーバーに、ユーザーの Delete を 1 回ずつ送る。
 *
 * @param user - 削除されたローカルユーザー
 * @param concerned - {@link collectConcernedRemoteUsers} で集めたもの
 * @returns 送ったサーバー（inbox）の数
 *
 * @remarks
 * - 配送はサーバーの数だけ。投稿の数には比例しない。
 * - 共有 inbox があればそれに、無ければ個人の inbox に送る。
 * - すでに doPostSuspend で送ったサーバーにもう一度届くことがあるが、相手は「削除済み」として捨てるだけ。
 *
 * @internal
 */
async function deliverDeleteToConcernedServers(
	user: ILocalUser,
	concerned: { uris: Set<string>; userIds: Set<string> },
): Promise<number> {
	const inboxes = new Map<string, boolean>();
	const addUsers = (users: { inbox: string | null; sharedInbox: string | null }[]) => {
		for (const u of users) {
			if (u.sharedInbox) inboxes.set(u.sharedInbox, true);
			else if (u.inbox && !inboxes.has(u.inbox)) inboxes.set(u.inbox, false);
		}
	};

	// 件数が多くても 1 回の問い合わせが大きくなりすぎないよう、500 件ずつ引く
	const chunks = <T,>(xs: T[]): T[][] =>
		Array.from({ length: Math.ceil(xs.length / 500) }, (_, i) => xs.slice(i * 500, i * 500 + 500));
	for (const uris of chunks([...concerned.uris])) {
		addUsers(await Users.find({ select: ["inbox", "sharedInbox"], where: { uri: In(uris) } }));
	}
	for (const ids of chunks([...concerned.userIds])) {
		addUsers(
			(await Users.find({ select: ["host", "inbox", "sharedInbox"], where: { id: In(ids) } }))
				.filter((u) => u.host != null),
		);
	}
	if (inboxes.size === 0) return 0;

	const content = renderActivity(
		renderDelete(`${config.url}/users/${user.id}`, user),
	);
	for (const [inbox, shared] of inboxes) deliver(user, content, inbox, shared);
	return inboxes.size;
}
