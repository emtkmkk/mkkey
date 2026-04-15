/**
 * @packageDocumentation
 *
 * `users/stats` 向けの DB 集計結果を表す型。集計サービスとレスポンス組み立てで共有する。
 *
 * @remarks
 * - 値は DB からそのまま渡すため、一部は `string` 型のまま返る（従来エンドポイントと同様に算術で暗黙変換）。
 *
 * @internal
 */

/** `awaitAll` 第1ブロック（全期間）の行 */
export type UserStatsPrimaryAggregateRow = {
	userNo?: number;
	notesCount: number;
	repliesCount: number;
	renotesCount: number;
	quotesCount: number;
	repliedCount: number;
	renotedCount: number;
	pollVotesCount: number;
	pollVotedCount: number;
	localFollowingCount: number;
	remoteFollowingCount: number;
	localFollowersCount: number;
	remoteFollowersCount: number;
	deliverServersCount?: number;
	sentReactionsCount: number;
	receivedReactionsCount: number;
	noteFavoritesCount: number;
	pageLikesCount: number;
	pageLikedCount: number;
	driveFilesCount: number;
	driveUsage: number;
	notesPostDays: number;
	totalWordCount?: number;
	ojNotesCount?: number;
	ojSentReactionsCount?: number;
	totalInviteCount?: number;
};

/** 直近ウィンドウ内の集計行 */
export type UserStatsRankWindowAggregateRow = {
	notesCount: number;
	repliesCount: number;
	renotesCount: number;
	quotesCount: number;
	repliedCount: number;
	renotedCount: number;
	pollVotesCount: number;
	pollVotedCount: number;
	sentReactionsCount: number;
	receivedReactionsCount: number;
	noteFavoritesCount: number;
	pageLikesCount: number;
	pageLikedCount: number;
	driveFilesCount: number;
	notesPostDays: number;
	sendMessageCount: number;
	readMessageCount: number;
};

/**
 * `fetchUserStatsAggregates` の戻り値。
 * メッセージ件数・ランク用ウィンドウ・経過日数計算に必要な副情報を含む。
 */
export type UserStatsAggregatesPayload = {
	sendMessageCount: number;
	readMessageCount: number;
	primaryRow: UserStatsPrimaryAggregateRow;
	rankRow: UserStatsRankWindowAggregateRow;
	/** ランク分母などに使う生の経過日数（端数あり） */
	elapsedDaysRaw: number;
	/** `Math.max(Math.min(elapsedDaysRaw, 31), 1)` */
	elapsedDays: number;
	/**
	 * リモートユーザーで最初のローカルフォロワーが付いた日時（ms）。無い場合は `undefined`。
	 * 表示上の `elapsedDays` や `powerRank?` の判定に使う。
	 */
	firstLocalFollowerMs: number | undefined;
};
