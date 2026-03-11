/**
 * meta_all_emojis / federation/stats / emoji-stats 用 MATERIALIZED VIEW の REFRESH ジョブ。
 *
 * - refreshStatsMvEmoji: 毎時 17 分に mv_emoji_remote_snapshot を REFRESH
 * - refreshStatsMvFederationAndEmojiStats: 毎時 47 分に federation/stats 用・emoji-stats 用の 3 本を REFRESH
 */
import type Bull from "bull";
import { getStatsDataSource } from "@/db/postgre.js";
import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("refresh-stats-mv");

const MV_EMOJI_REMOTE = "mv_emoji_remote_snapshot";
const MV_FEDERATION_FOLLOWERS = "mv_federation_top_by_followers";
const MV_FEDERATION_FOLLOWING = "mv_federation_top_by_following";
const MV_EMOJI_STATS_RECENTLY = "mv_emoji_stats_recently_sent_local_no_bots";

async function refreshConcurrently(name: string): Promise<void> {
	const ds = getStatsDataSource();
	await ds.query(
		`REFRESH MATERIALIZED VIEW CONCURRENTLY ${name}`,
	);
}

/**
 * 毎時 17 分: meta_all_emojis 用 MV のみ REFRESH
 */
export async function refreshStatsMvEmoji(
	job: Bull.Job<Record<string, unknown>>,
	done: (err?: Error) => void,
): Promise<void> {
	try {
		logger.info("Refreshing mv_emoji_remote_snapshot...");
		job.log("info - Refreshing mv_emoji_remote_snapshot...");
		await refreshConcurrently(MV_EMOJI_REMOTE);
		logger.succ("mv_emoji_remote_snapshot refreshed.");
		job.log("succ - mv_emoji_remote_snapshot refreshed.");
		job.progress(100);
		done();
	} catch (err) {
		logger.warn("refreshStatsMvEmoji failed", { err });
		job.log(`warn - ${String(err)}`);
		done(err instanceof Error ? err : new Error(String(err)));
	}
}

/**
 * 毎時 47 分: federation/stats 用・emoji-stats 用の 3 本を順に REFRESH
 */
export async function refreshStatsMvFederationAndEmojiStats(
	job: Bull.Job<Record<string, unknown>>,
	done: (err?: Error) => void,
): Promise<void> {
	const mvs = [
		MV_FEDERATION_FOLLOWERS,
		MV_FEDERATION_FOLLOWING,
		MV_EMOJI_STATS_RECENTLY,
	];
	try {
		for (const name of mvs) {
			logger.info(`Refreshing ${name}...`);
			job.log(`info - Refreshing ${name}...`);
			try {
				await refreshConcurrently(name);
				logger.succ(`${name} refreshed.`);
			} catch (err) {
				logger.warn(`${name} refresh failed`, { err });
				job.log(`warn - ${name} failed: ${String(err)}`);
				// 計画: いずれか失敗時はログを出して次を実行
			}
		}
		job.progress(100);
		done();
	} catch (err) {
		logger.warn("refreshStatsMvFederationAndEmojiStats failed", { err });
		done(err instanceof Error ? err : new Error(String(err)));
	}
}
