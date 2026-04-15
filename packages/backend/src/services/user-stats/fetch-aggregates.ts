/**
 * @packageDocumentation
 *
 * ユーザー統計 API 用の DB 集計を一括で取得する（従来 `users/stats` 内のクエリ群）。
 *
 * @remarks
 * - `getStatsDataSource` による統計用 DB 接続を使用する。
 * - クエリキャッシュ TTL は従来どおり 600 秒（一部倍率あり）。
 *
 * @see {@link buildUserStatsResultFromAggregates} 集計後の派生値・パワー適用
 * @internal
 */
import { getStatsDataSource } from "@/db/postgre.js";
import {
	DriveFiles,
	NoteFavorites,
	NoteReactions,
	PageLikes,
	Users,
} from "@/models/index.js";
import { DriveFile } from "@/models/entities/drive-file.js";
import { Following } from "@/models/entities/following.js";
import { Note } from "@/models/entities/note.js";
import { NoteFavorite } from "@/models/entities/note-favorite.js";
import { NoteReaction } from "@/models/entities/note-reaction.js";
import { PageLike } from "@/models/entities/page-like.js";
import { MessagingMessage } from "@/models/entities/messaging-message.js";
import { PollVote } from "@/models/entities/poll-vote.js";
import { User } from "@/models/entities/user.js";
import { awaitAll } from "@/prelude/await-all.js";
import type { UserStatsAggregatesPayload } from "./types.js";

const RANK_TARGET_DAYS = 31;
const CACHE_TIME_MS = 600 * 1000;

export type FetchUserStatsAggregatesParams = {
	user: User;
	simple: boolean;
	/** 招待数を集計するか（本人または管理者のみ） */
	includeInviteCount: boolean;
};

/**
 * 指定ユーザーの統計用生データを DB から取得する。
 *
 * @param params - 対象ユーザーと省略フラグ
 * @returns メッセージ件数・全期間/ウィンドウ集計・経過日数計算用の値
 * @public
 */
export async function fetchUserStatsAggregates(
	params: FetchUserStatsAggregatesParams,
): Promise<UserStatsAggregatesPayload> {
	const { user, simple, includeInviteCount } = params;
	if (!user.id) {
		throw new Error("fetchUserStatsAggregates: user.id is required");
	}

	const statsDs = getStatsDataSource();
	const NotesRepo = statsDs.getRepository(Note);
	const FollowingsRepo = statsDs.getRepository(Following);
	const NoteFavoritesRepo = statsDs.getRepository(NoteFavorite);
	const NoteReactionsRepo = statsDs.getRepository(NoteReaction);
	const PageLikesRepo = statsDs.getRepository(PageLike);
	const PollVotesRepo = statsDs.getRepository(PollVote);
	const MessagingMessagesRepo = statsDs.getRepository(MessagingMessage);
	const DriveFilesRepo = statsDs.getRepository(DriveFile);

	const now = new Date();
	let borderDate = new Date();

	borderDate.setDate(now.getDate() - RANK_TARGET_DAYS);
	borderDate.setMinutes(0);
	borderDate.setSeconds(0);
	borderDate.setMilliseconds(0);

	const firstLocalFollowerMs = user.host
		? Date.parse(
				(
					await FollowingsRepo.createQueryBuilder("following")
						.select('min(following."createdAt")', "min")
						.where("following.followeeId = :userId", { userId: user.id })
						.andWhere("following.followerHost IS NULL")
						.cache(CACHE_TIME_MS)
						.getRawOne()
				).min,
			)
		: undefined;

	const userCreatedAtDate = firstLocalFollowerMs
		? firstLocalFollowerMs
		: new Date(user.createdAt).getTime();

	if (firstLocalFollowerMs && borderDate.valueOf() < firstLocalFollowerMs) {
		borderDate = new Date(firstLocalFollowerMs);
	}

	const elapsedDaysRaw =
		Math.ceil((now.getTime() - userCreatedAtDate) / (1000 * 60 * 60 * 2.4)) /
		10;
	const elapsedDays = Math.max(
		Math.min(elapsedDaysRaw, RANK_TARGET_DAYS),
		1,
	);

	const countDeliver = async () => {
		const inboxes = new Set<string>();
		const followers = await FollowingsRepo.createQueryBuilder("following")
			.select("following.followerSharedInbox")
			.addSelect("following.followerInbox")
			.where("following.followeeId = :userId", { userId: user.id })
			.andWhere("following.followerHost IS NOT NULL")
			.cache(CACHE_TIME_MS)
			.getMany();
		for (const following of followers) {
			const inbox = following.followerSharedInbox || following.followerInbox;
			inboxes.add(inbox);
		}
		return inboxes.size;
	};

	const [sendMessageCount, readMessageCount, primaryRow, rankRow] =
		await Promise.all([
			MessagingMessagesRepo.createQueryBuilder("messaging_message")
				.where("messaging_message.userId = :userId", { userId: user.id })
				.cache(CACHE_TIME_MS)
				.getCount(),
			MessagingMessagesRepo.createQueryBuilder("messaging_message")
				.where(" :userIdList <@ (messaging_message.reads) ", {
					userIdList: [user.id],
				})
				.cache(CACHE_TIME_MS)
				.getCount(),
			awaitAll({
				userNo: !user.host
					? (await Users.createQueryBuilder("user")
							.select("count(user.id) count")
							.where("user.host IS NULL")
							.andWhere("user.createdAt <= :borderDate", {
								borderDate: new Date(user.createdAt).toISOString(),
							})
							.cache(CACHE_TIME_MS * 100)
							.getRawOne()
						).count + 1
					: undefined,
				notesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.visibility <> 'specified'")
					.cache(CACHE_TIME_MS)
					.getCount(),
				repliesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.visibility <> 'specified'")
					.andWhere("note.replyId IS NOT NULL")
					.cache(CACHE_TIME_MS)
					.getCount(),
				renotesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.visibility <> 'specified'")
					.andWhere("note.text IS NULL")
					.andWhere("note.renoteId IS NOT NULL")
					.cache(CACHE_TIME_MS)
					.getCount(),
				quotesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.visibility <> 'specified'")
					.andWhere("note.text IS NOT NULL")
					.andWhere("note.renoteId IS NOT NULL")
					.cache(CACHE_TIME_MS)
					.getCount(),
				repliedCount: NotesRepo.createQueryBuilder("note")
					.where("note.replyUserId = :userId", { userId: user.id })
					.andWhere("note.visibility <> 'specified'")
					.cache(CACHE_TIME_MS)
					.getCount(),
				renotedCount: NotesRepo.createQueryBuilder("note")
					.where("note.renoteUserId = :userId", { userId: user.id })
					.andWhere("note.visibility <> 'specified'")
					.cache(CACHE_TIME_MS)
					.getCount(),
				pollVotesCount: PollVotesRepo.createQueryBuilder("vote")
					.where("vote.userId = :userId", { userId: user.id })
					.cache(CACHE_TIME_MS)
					.getCount(),
				pollVotedCount: PollVotesRepo.createQueryBuilder("vote")
					.innerJoin("vote.note", "note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.visibility <> 'specified'")
					.cache(CACHE_TIME_MS)
					.getCount(),
				localFollowingCount: FollowingsRepo.createQueryBuilder("following")
					.where("following.followerId = :userId", { userId: user.id })
					.andWhere("following.followeeHost IS NULL")
					.cache(CACHE_TIME_MS)
					.getCount(),
				remoteFollowingCount: FollowingsRepo.createQueryBuilder("following")
					.where("following.followerId = :userId", { userId: user.id })
					.andWhere("following.followeeHost IS NOT NULL")
					.cache(CACHE_TIME_MS)
					.getCount(),
				localFollowersCount: FollowingsRepo.createQueryBuilder("following")
					.where("following.followeeId = :userId", { userId: user.id })
					.andWhere("following.followerHost IS NULL")
					.cache(CACHE_TIME_MS)
					.getCount(),
				remoteFollowersCount: FollowingsRepo.createQueryBuilder("following")
					.where("following.followeeId = :userId", { userId: user.id })
					.andWhere("following.followerHost IS NOT NULL")
					.cache(CACHE_TIME_MS)
					.getCount(),
				deliverServersCount: !simple ? countDeliver() : undefined,
				sentReactionsCount: NoteReactionsRepo.createQueryBuilder("reaction")
					.where("reaction.userId = :userId", { userId: user.id })
					.cache(CACHE_TIME_MS)
					.getCount(),
				receivedReactionsCount: NoteReactionsRepo.createQueryBuilder("reaction")
					.innerJoin("reaction.note", "note")
					.where("note.userId = :userId", { userId: user.id })
					.cache(CACHE_TIME_MS)
					.getCount(),
				noteFavoritesCount: NoteFavoritesRepo.createQueryBuilder("favorite")
					.where("favorite.userId = :userId", { userId: user.id })
					.cache(CACHE_TIME_MS)
					.getCount(),
				pageLikesCount: PageLikesRepo.createQueryBuilder("like")
					.where("like.userId = :userId", { userId: user.id })
					.cache(CACHE_TIME_MS)
					.getCount(),
				pageLikedCount: PageLikesRepo.createQueryBuilder("like")
					.innerJoin("like.page", "page")
					.where("page.userId = :userId", { userId: user.id })
					.cache(CACHE_TIME_MS)
					.getCount(),
				driveFilesCount: DriveFilesRepo.createQueryBuilder("file")
					.where("file.userId = :userId", { userId: user.id })
					.cache(CACHE_TIME_MS)
					.getCount(),
				driveUsage: DriveFiles.calcDriveUsageOf(user),
				notesPostDays: (
					await NotesRepo.createQueryBuilder("note")
						.select(
							"count(distinct date_trunc('day',note.\"createdAt\")) count",
						)
						.where("note.userId = :userId", { userId: user.id })
						.andWhere("'misshaialert' <> ALL(note.tags)")
						.andWhere("note.visibility <> 'specified'")
						.cache(CACHE_TIME_MS)
						.getRawOne()
				).count,
				totalWordCount: !simple
					? (
							await NotesRepo.createQueryBuilder("note")
								.select(
									"coalesce(sum(length(regexp_replace(regexp_replace(note.text,'(:\\w+?:)','☆', 'g'),'(<\\/?\\w+>|\\$\\[\\S+\\s|https?:\\/\\/[\\w\\/:%#\\$&@\\?\\(\\)~\\.=\\+\\-]+|@\\w+|#\\S+|\\s+)','', 'ig'))),0) + coalesce(sum(length(regexp_replace(regexp_replace(note.cw,'(:\\w+?:)','☆', 'g'),'(<\\/?\\w+>|\\$\\[\\S+\\s|https?:\\/\\/[\\w\\/:%#\\$&@\\?\\(\\)~\\.=\\+\\-]+|@\\w+|#\\S+|\\s+)','', 'ig'))),0) count",
								)
								.where("note.userId = :userId", { userId: user.id })
								.cache(CACHE_TIME_MS * 2)
								.getRawOne()
						).count
					: undefined,
				ojNotesCount: !simple
					? NotesRepo.createQueryBuilder("note")
							.where("note.userId = :userId", { userId: user.id })
							.andWhere("note.visibility <> 'specified'")
							.andWhere(
								"((note.text LIKE '%ですわ%') OR (note.text LIKE '%わよ%') OR (note.text LIKE '%わね%') OR (note.text LIKE '%desuwa%') OR (note.text LIKE '%wayo%') OR (note.text LIKE '%wane%') OR (note.text LIKE '%maa%'))",
							)
							.cache(CACHE_TIME_MS)
							.getCount()
					: undefined,
				ojSentReactionsCount: !simple
					? NoteReactionsRepo.createQueryBuilder("reaction")
							.where("reaction.userId = :userId", { userId: user.id })
							.andWhere(
								"((reaction.reaction LIKE '%desuwa%') OR (reaction.reaction LIKE '%wayo%') OR (reaction.reaction LIKE '%wane%') OR (reaction.reaction LIKE '%maa%'))",
							)
							.cache(CACHE_TIME_MS)
							.getCount()
					: undefined,
				totalInviteCount: includeInviteCount
					? Users.createQueryBuilder("user")
							.where("user.inviteUserId = :userId", { userId: user.id })
							.cache(CACHE_TIME_MS)
							.getCount()
					: undefined,
			}),
			awaitAll({
				notesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.getCount(),
				repliesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.replyId IS NOT NULL")
					.andWhere("note.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				renotesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.text IS NULL")
					.andWhere("note.renoteId IS NOT NULL")
					.andWhere("note.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				quotesCount: NotesRepo.createQueryBuilder("note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("note.text IS NOT NULL")
					.andWhere("note.renoteId IS NOT NULL")
					.andWhere("note.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				repliedCount: NotesRepo.createQueryBuilder("note")
					.where("note.replyUserId = :userId", { userId: user.id })
					.andWhere("note.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				renotedCount: NotesRepo.createQueryBuilder("note")
					.where("note.renoteUserId = :userId", { userId: user.id })
					.andWhere("note.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				pollVotesCount: PollVotesRepo.createQueryBuilder("vote")
					.where("vote.userId = :userId", { userId: user.id })
					.andWhere("vote.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				pollVotedCount: PollVotesRepo.createQueryBuilder("vote")
					.innerJoin("vote.note", "note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("vote.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				sentReactionsCount: NoteReactionsRepo.createQueryBuilder("reaction")
					.where("reaction.userId = :userId", { userId: user.id })
					.andWhere("reaction.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				receivedReactionsCount: NoteReactionsRepo.createQueryBuilder("reaction")
					.innerJoin("reaction.note", "note")
					.where("note.userId = :userId", { userId: user.id })
					.andWhere("reaction.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				noteFavoritesCount: NoteFavoritesRepo.createQueryBuilder("favorite")
					.where("favorite.userId = :userId", { userId: user.id })
					.andWhere("favorite.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				pageLikesCount: PageLikesRepo.createQueryBuilder("like")
					.where("like.userId = :userId", { userId: user.id })
					.andWhere("like.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				pageLikedCount: PageLikesRepo.createQueryBuilder("like")
					.innerJoin("like.page", "page")
					.where("page.userId = :userId", { userId: user.id })
					.andWhere("like.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				driveFilesCount: DriveFilesRepo.createQueryBuilder("file")
					.where("file.userId = :userId", { userId: user.id })
					.andWhere("file.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				notesPostDays: (
					await NotesRepo.createQueryBuilder("note")
						.select(
							"count(distinct date_trunc('day',note.\"createdAt\")) count",
						)
						.where("note.userId = :userId", { userId: user.id })
						.andWhere("note.visibility <> 'hidden'")
						.andWhere("'misshaialert' <> ALL(note.tags)")
						.andWhere("note.createdAt >= :borderDate", {
							borderDate: borderDate.toISOString(),
						})
						.cache(CACHE_TIME_MS)
						.getRawOne()
				).count,
				sendMessageCount: await MessagingMessagesRepo.createQueryBuilder(
					"messaging_message",
				)
					.where("messaging_message.userId = :userId", { userId: user.id })
					.andWhere("messaging_message.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
				readMessageCount: await MessagingMessagesRepo.createQueryBuilder(
					"messaging_message",
				)
					.where(" :userIdList <@ (messaging_message.reads) ", {
						userIdList: [user.id],
					})
					.andWhere("messaging_message.createdAt >= :borderDate", {
						borderDate: borderDate.toISOString(),
					})
					.cache(CACHE_TIME_MS)
					.getCount(),
			}),
		]);

	return {
		sendMessageCount,
		readMessageCount,
		primaryRow,
		rankRow,
		elapsedDaysRaw,
		elapsedDays,
		firstLocalFollowerMs,
	};
}
