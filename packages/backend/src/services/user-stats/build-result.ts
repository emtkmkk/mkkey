/**
 * @packageDocumentation
 *
 * `fetchUserStatsAggregates` の結果から、API 応答用の統計オブジェクトを組み立てる（DB なし）。
 *
 * @remarks
 * - パワー・ランクは {@link computeDisplayPower} / {@link computePowerRankFromWindow} に委譲する。
 * - リモート向け `powerRank` の `?` は行わない（エンドポイント側の責務）。
 *
 * @see {@link fetchUserStatsAggregates}
 * @internal
 */
import { User } from "@/models/entities/user.js";
import {
	computeDisplayPower,
	computeOjPower,
	computePowerRankFromWindow,
} from "@/services/user-power.js";
import type { UserStatsAggregatesPayload } from "./types.js";

export type BuildUserStatsResultParams = {
	user: User;
	simple: boolean;
	aggregates: UserStatsAggregatesPayload;
};

/** `buildUserStatsResultFromAggregates` の戻り値（キャッシュには `result` のみ載せる） */
export type BuiltUserStatsResult = {
	/** API 応答・キャッシュ用（内部キーを含めない） */
	result: Record<string, unknown>;
	/** `Users.maxRankPoint` 更新に使う床付きランク指標 */
	effectiveRankPowerFloored: number;
};

/**
 * 集計済みデータから `users/stats` 相当のレスポンスオブジェクトを構築する。
 *
 * @param params - ユーザー・simple フラグ・集計ペイロード
 * @returns 応答用 `result` と `maxRankPoint` 更新用の指標
 * @public
 */
export function buildUserStatsResultFromAggregates(
	params: BuildUserStatsResultParams,
): BuiltUserStatsResult {
	const { user, simple, aggregates } = params;
	const {
		sendMessageCount,
		readMessageCount,
		primaryRow: p,
		rankRow,
		elapsedDaysRaw,
		elapsedDays,
		firstLocalFollowerMs,
	} = aggregates;

	const result: Record<string, unknown> = { ...p };

	result.followingCount = user.host
		? user.followingCount
		: p.localFollowingCount + p.remoteFollowingCount;
	result.followersCount = user.host
		? user.followersCount
		: p.localFollowersCount + p.remoteFollowersCount;

	result.averagePostCount =
		Math.floor((p.notesCount / (p.notesPostDays || 1)) * 10) / 10;
	result.averageWordCount = !simple
		? Math.floor(
				((p.totalWordCount as number) /
					(p.notesCount - p.renotesCount || 1)) *
					10,
			) / 10
		: undefined;
	result.averageSentReactionsCount =
		Math.floor((p.sentReactionsCount / elapsedDaysRaw) * 10) / 10;
	result.averageReceivedReactionsCount =
		Math.floor((p.receivedReactionsCount / elapsedDaysRaw) * 10) / 10;
	result.elapsedDays =
		!firstLocalFollowerMs && user.host ? 0 : elapsedDaysRaw;

	if (!simple && p.ojNotesCount != null && p.ojSentReactionsCount != null) {
		result.ojPower = computeOjPower(p.ojNotesCount, p.ojSentReactionsCount);
	}

	const followingCount = result.followingCount as number;
	const followersCount = result.followersCount as number;

	result.power = computeDisplayPower({
		notesPostDays: p.notesPostDays,
		notesCount: p.notesCount,
		notesCountForPower: Math.max(
			p.notesCount,
			user.host ? user.notesCount : 0,
		),
		repliesCount: p.repliesCount,
		renotesCount: p.renotesCount,
		quotesCount: p.quotesCount,
		repliedCount: p.repliedCount,
		renotedCount: p.renotedCount,
		pollVotesCount: p.pollVotesCount,
		pollVotedCount: p.pollVotedCount,
		pageLikesCount: p.pageLikesCount,
		pageLikedCount: p.pageLikedCount,
		sentReactionsCount: p.sentReactionsCount,
		receivedReactionsCount: p.receivedReactionsCount,
		driveFilesCount: p.driveFilesCount,
		sendMessageCount,
		readMessageCount,
		followingCount,
		followersCount,
	});

	const rank = computePowerRankFromWindow({
		rankWindow: {
			notesPostDays: rankRow.notesPostDays,
			notesCount: rankRow.notesCount,
			repliesCount: rankRow.repliesCount,
			renotesCount: rankRow.renotesCount,
			quotesCount: rankRow.quotesCount,
			repliedCount: rankRow.repliedCount,
			renotedCount: rankRow.renotedCount,
			pollVotesCount: rankRow.pollVotesCount,
			pollVotedCount: rankRow.pollVotedCount,
			sentReactionsCount: rankRow.sentReactionsCount,
			receivedReactionsCount: rankRow.receivedReactionsCount,
			driveFilesCount: rankRow.driveFilesCount,
			sendMessageCount: rankRow.sendMessageCount,
			readMessageCount: rankRow.readMessageCount,
		},
		elapsedDays,
		isBot: user.isBot,
	});

	result.powerRank = rank.powerRank;
	result.nextRank = rank.nextRank;
	result.rankPoint = rank.rankPoint;

	return {
		result,
		effectiveRankPowerFloored: rank.effectiveRankPowerFloored,
	};
}
