/**
 * @packageDocumentation
 *
 * 定期クリーンアップジョブ。UserIps・ノート・ドライブ・フォロー等の古いデータを削除する。
 *
 * @remarks
 * - **役割**: システムキューで定期実行し、保持期間を過ぎたデータを削除する。
 * - **リモート DriveFile**: ノート添付に加え、どのユーザの `avatarId` / `bannerId` からも参照されていないものだけを削除対象とする（プロフィール画像は `note.fileIds` に現れないため）。
 *
 * @internal
 */
import type Bull from "bull";
import { Brackets, LessThan } from "typeorm";
import { DriveFiles, Notes, UserIps, Users } from "@/models/index.js";

import { queueLogger } from "../../logger.js";
import { genId } from "@/misc/gen-id.js";
import { Note } from "@/models/entities/note.js";
import { db } from "@/db/postgre.js";
import type { User } from "@/models/entities/user.js";
import { fetchProxyAccount } from "@/misc/fetch-proxy-account.js";
import createFollowing from "@/services/following/create.js";
import deleteFollowing from "@/services/following/delete.js";
import { deleteFileSync } from "@/services/drive/delete-file.js";
import { UserListJoining } from "@/models/entities/user-list-joining.js";
import { Following } from "@/models/entities/following.js";
import { FollowRequest } from "@/models/entities/follow-request.js";

const logger = queueLogger.createSubLogger("clean");

export async function clean(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Cleaning...");
	job.log("info - " + "Cleaning...");

	logger.info("UserIps Cleaning...");
	job.log("info - " + "UserIps Cleaning...");
	UserIps.delete({
		createdAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)),
	});

        logger.succ("UserIps Cleaned.");
        job.log("succ - " + "UserIps Cleaned.");

        job.progress(0);

        logger.info("Notes Cleaning...");
	job.log("info - " + "Notes Cleaning...");

	{
		let deleteCount = 0;
		let failedCount = 0;
		// ノートを削除
		const maxDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60)
		const minDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)
		let cursor: Note["id"] | null = genId(minDate);
                const total = (await Notes.createQueryBuilder('note')
                        .where("note.id < :maxId", { maxId: genId(maxDate) })
                        .andWhere(cursor ? "note.id > :cursor" : "1=1", { cursor })
                        .andWhere(new Brackets(qb => {
                                qb.where("note.visibility = :public", { public: 'public' })
                                        .orWhere("note.visibility = :home", { home: 'home' })
                                        .orWhere("note.deletedAt IS NOT NULL");
                        }))
                        .andWhere("note.userHost IS NOT NULL")
                        .andWhere("note.repliesCount = :repliesCount", { repliesCount: 0 })
                        .andWhere("note.score = :score", { score: 0 })
                        .andWhere('NOT EXISTS (SELECT 1 FROM "note_favorite" nf WHERE nf."noteId" = note.id)')
                        .andWhere('NOT EXISTS (SELECT 1 FROM "clip_note" cn WHERE cn."noteId" = note.id)')
                        .andWhere('NOT EXISTS (SELECT 1 FROM "antenna_note" an WHERE an."noteId" = note.id)')
                        .getCount())

		logger.info(`Clean Notes Count: ${total}`);
		job.log(`info - Clean Notes Count: ${total}`);

		while (true) {
                        const notes = (await Notes.createQueryBuilder('note')
                                .where("note.id < :maxId", { maxId: genId(maxDate) })
                                .andWhere(cursor ? "note.id > :cursor" : "1=1", { cursor })
                                .andWhere(new Brackets(qb => {
                                        qb.where("note.visibility = :public", { public: 'public' })
                                                .orWhere("note.visibility = :home", { home: 'home' })
                                                .orWhere("note.deletedAt IS NOT NULL");
                                }))
                                .andWhere("note.userHost IS NOT NULL")
                                .andWhere("note.repliesCount = :repliesCount", { repliesCount: 0 })
                                .andWhere("note.score = :score", { score: 0 })
                                .andWhere('NOT EXISTS (SELECT 1 FROM "note_favorite" nf WHERE nf."noteId" = note.id)')
                                .andWhere('NOT EXISTS (SELECT 1 FROM "clip_note" cn WHERE cn."noteId" = note.id)')
                                .andWhere('NOT EXISTS (SELECT 1 FROM "antenna_note" an WHERE an."noteId" = note.id)')
                                .orderBy("note.id", "ASC")
                                .take(300)
                                .getMany()) as Note[];

			if (notes.length === 0) {
				break;
			}

			cursor = notes[notes.length - 1].id;

			try {
				await Notes.delete(notes.map((note) => note.id));
				deleteCount += notes.length;
				logger.info(
					`Notes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log(`info - Notes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
			} catch {
				failedCount += notes.length;
				logger.info(
					`Notes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log(`info - Notes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
			}
			job.progress(+((deleteCount + failedCount) / total * 100).toFixed(2));
		}

		if (deleteCount + failedCount)
			logger.succ(
				`Notes Cleaned. (${deleteCount}${failedCount ? ` / ${failedCount}` : ""
				})`,
			);
		job.log(`succ - Notes Cleaned. (${deleteCount}${failedCount ? ` / ${failedCount}` : ""
			})`,
		);
        }

        logger.info("リモートDriveFileの参照状態を確認します...");
        job.log("info - " + "リモートDriveFileの参照状態を確認します...");

        const driveFileThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365);
        let driveFileCursor: string | null = null;
        let driveFileDeleteCount = 0;
        let driveFileFailedCount = 0;

        while (true) {
                const files = await DriveFiles.createQueryBuilder("file")
                        .where("file.createdAt < :threshold", { threshold: driveFileThreshold })
                        .andWhere("file.userHost IS NOT NULL")
                        .andWhere(
                                `NOT EXISTS (SELECT 1 FROM note WHERE note."fileIds" && ARRAY[file."id"]::varchar[])`,
                        )
                        // アイコン・バナー用の DriveFile は note の添付配列に含まれないため、user 側の参照がある場合は削除しない
                        .andWhere(
                                `NOT EXISTS (SELECT 1 FROM "user" u WHERE u."avatarId" = file.id OR u."bannerId" = file.id)`,
                        )
                        .andWhere(driveFileCursor ? "file.id > :cursor" : "1=1", { cursor: driveFileCursor })
                        .orderBy("file.id", "ASC")
                        .take(100)
                        .getMany();

                if (files.length === 0) {
                        break;
                }

                driveFileCursor = files[files.length - 1].id;

                for (const file of files) {
                        try {
                                await deleteFileSync(file);
                                driveFileDeleteCount += 1;
                        } catch (err) {
                                driveFileFailedCount += 1;
                                const errorMessage = err instanceof Error ? err.message : `${err}`;
                                logger.warn(
                                        `DriveFileの削除に失敗しました: ${file.id} - ${errorMessage}`,
                                );
                                job.log(
                                        `warn - DriveFileの削除に失敗しました: ${file.id} - ${errorMessage}`,
                                );
                        }
                }
        }

        if (driveFileDeleteCount + driveFileFailedCount > 0) {
                logger.info(
                        `不要なDriveFileを削除しました: ${driveFileDeleteCount}${driveFileFailedCount ? ` / ${driveFileFailedCount}` : ""}`,
                );
                job.log(
                        `info - 不要なDriveFileを削除しました: ${driveFileDeleteCount}${driveFileFailedCount ? ` / ${driveFileFailedCount}` : ""}`,
                );
        }

        logger.info("Proxyアカウントのフォロー状態を確認します...");
        job.log("info - Proxyアカウントのフォロー状態を確認します...");

        const proxy = await fetchProxyAccount();
        if (!proxy) {
                logger.info("Proxyアカウントが設定されていないためスキップします。");
                job.log("info - Proxyアカウントが設定されていないためスキップします。");
        } else {
                const describeUser = (user: User) =>
                        `${user.username}${user.host ? `@${user.host}` : ""} (${user.id})`;

                const initialFollowingCount = proxy.followingCount ?? 0;
                let currentProxyFollowingCount = initialFollowingCount;

                const followCandidates = await Users.createQueryBuilder("user")
                        .select("user.id", "id")
                        .innerJoin(UserListJoining, "joining", "joining.userId = user.id")
                        .leftJoin(
                                Following,
                                "localFollow",
                                "localFollow.followeeId = user.id AND localFollow.followerHost IS NULL",
                        )
                        .leftJoin(
                                Following,
                                "proxyFollow",
                                "proxyFollow.followeeId = user.id AND proxyFollow.followerId = :proxyId",
                                { proxyId: proxy.id },
                        )
                        .leftJoin(
                                FollowRequest,
                                "proxyRequest",
                                "proxyRequest.followeeId = user.id AND proxyRequest.followerId = :proxyId",
                                { proxyId: proxy.id },
                        )
                        .where("user.host IS NOT NULL")
                        .andWhere("proxyFollow.id IS NULL")
                        .andWhere("proxyRequest.id IS NULL")
                        .groupBy("user.id")
                        .having("COUNT(localFollow.id) = 0")
                        .getRawMany<{ id: string }>();

                logger.info(`Proxyフォロー追加候補: ${followCandidates.length}件`);
                job.log(`info - Proxyフォロー追加候補: ${followCandidates.length}件`);

                for (const { id } of followCandidates) {
                        const target = await Users.findOneBy({ id });
                        if (!target) {
                                logger.warn(`対象ユーザーが見つかりません: ${id}`);
                                job.log(`warn - 対象ユーザーが見つかりません: ${id}`);
                                continue;
                        }

                        const description = describeUser(target);

                        logger.info(`Proxyでフォロー処理を実行します: ${description}`);
                        job.log(`info - Proxyでフォロー処理を実行します: ${description}`);

                        try {
                                await createFollowing(proxy, target);
                                currentProxyFollowingCount += 1;
                                proxy.followingCount = currentProxyFollowingCount;
                                logger.succ(`Proxyでフォローしました: ${description}`);
                                job.log(`succ - Proxyでフォローしました: ${description}`);
                        } catch (err) {
                                const errorMessage = err instanceof Error ? err.message : `${err}`;
                                logger.error(
                                        `Proxyでのフォローに失敗しました: ${description} - ${errorMessage}`,
                                );
                                job.log(
                                        `error - Proxyでのフォローに失敗しました: ${description} - ${errorMessage}`,
                                );
                        }
                }

                const unfollowCandidates = await Users.createQueryBuilder("user")
                        .select("user.id", "id")
                        .innerJoin(
                                Following,
                                "proxyFollow",
                                "proxyFollow.followeeId = user.id AND proxyFollow.followerId = :proxyId",
                                { proxyId: proxy.id },
                        )
                        .leftJoin(UserListJoining, "joining", "joining.userId = user.id")
                        .where("user.host IS NOT NULL")
                        .andWhere("joining.id IS NULL")
                        .getRawMany<{ id: string }>();

                logger.info(`Proxyフォロー解除候補: ${unfollowCandidates.length}件`);
                job.log(`info - Proxyフォロー解除候補: ${unfollowCandidates.length}件`);

                for (const { id } of unfollowCandidates) {
                        const target = await Users.findOneBy({ id });
                        if (!target) {
                                logger.warn(`対象ユーザーが見つかりません: ${id}`);
                                job.log(`warn - 対象ユーザーが見つかりません: ${id}`);
                                continue;
                        }

                        const description = describeUser(target);

                        logger.info(`Proxyでフォロー解除処理を実行します: ${description}`);
                        job.log(`info - Proxyでフォロー解除処理を実行します: ${description}`);

                        try {
                                await deleteFollowing(proxy, target, true);
                                currentProxyFollowingCount = Math.max(
                                        0,
                                        currentProxyFollowingCount - 1,
                                );
                                proxy.followingCount = currentProxyFollowingCount;
                                logger.succ(`Proxyでフォロー解除しました: ${description}`);
                                job.log(`succ - Proxyでフォロー解除しました: ${description}`);
                        } catch (err) {
                                const errorMessage = err instanceof Error ? err.message : `${err}`;
                                logger.error(
                                        `Proxyでのフォロー解除に失敗しました: ${description} - ${errorMessage}`,
                                );
                                job.log(
                                        `error - Proxyでのフォロー解除に失敗しました: ${description} - ${errorMessage}`,
                                );
                        }
                }

                const latestProxy = await Users.findOneBy({ id: proxy.id });
                if (latestProxy) {
                        const finalFollowingCount = latestProxy.followingCount ?? 0;
                        const diff = finalFollowingCount - initialFollowingCount;
                        const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                        logger.info(
                                `Proxyフォロー数変動: ${initialFollowingCount} -> ${finalFollowingCount} (${diffText})`,
                        );
                        job.log(
                                `info - Proxyフォロー数変動: ${initialFollowingCount} -> ${finalFollowingCount} (${diffText})`,
                        );
                } else {
                        logger.warn("Proxyアカウントの最終状態取得に失敗しました。");
                        job.log("warn - Proxyアカウントの最終状態取得に失敗しました。");
                }
        }

        db.query(`VACUUM ANALYZE`);

	logger.succ(`VACUUM ANALYZE`);
	job.log(`succ - VACUUM ANALYZE`),

	job.progress(100);
	done();
}
