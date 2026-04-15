/**
 * @packageDocumentation
 *
 * ユーザー統計（`users/stats`）の DB 集計と、応答用オブジェクトの組み立てを提供する。
 *
 * @internal
 */
export {
	buildUserStatsResultFromAggregates,
	type BuildUserStatsResultParams,
	type BuiltUserStatsResult,
} from "./build-result.js";
export {
	fetchUserStatsAggregates,
	type FetchUserStatsAggregatesParams,
} from "./fetch-aggregates.js";
export type {
	UserStatsAggregatesPayload,
	UserStatsPrimaryAggregateRow,
	UserStatsRankWindowAggregateRow,
} from "./types.js";
