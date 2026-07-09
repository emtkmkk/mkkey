/**
 * @packageDocumentation
 *
 * ローカル（本インスタンス上）のノート件数を短 TTL でキャッシュする。
 *
 * @remarks
 * - **役割**: タイムライン等で参照される件数。`Cache.fetch` で同一キー並列ミス時の DB 往復を 1 本にまとめる。
 * - **strict**: true のときはキャッシュを使わず毎回 `Notes.count` を実行する（鮮度が必要な経路用）。
 *
 * @internal
 */
import { Cache } from "@/misc/cache.js";
import { CACHE_MAX_SINGLETON } from "@/misc/cache-limits.js";
import { Notes } from "@/models/index.js";
import { IsNull } from "typeorm";

const LOCAL_NOTES_COUNT_TTL_MS = 1000 * 60 * 5;

const localNotesCountCache = new Cache<number>(LOCAL_NOTES_COUNT_TTL_MS, {
	maxEntries: CACHE_MAX_SINGLETON,
});

const localNotesCountCacheMetrics = {
	cacheHits: 0,
	cacheMisses: 0,
	dbExecutions: 0,
	totalDbLatencyMs: 0,
};

export async function getLocalNotesCount(options?: {
	strict?: boolean;
}): Promise<number> {
	if (options?.strict) {
		const before = performance.now();
		const count = await Notes.count({
			where: { userHost: IsNull(), deletedAt: IsNull() },
		});
		const after = performance.now();
		localNotesCountCacheMetrics.dbExecutions += 1;
		localNotesCountCacheMetrics.totalDbLatencyMs += after - before;
		return count;
	}

	const cached = localNotesCountCache.get(null);
	if (cached !== undefined) {
		localNotesCountCacheMetrics.cacheHits += 1;
		return cached;
	}

	// ミス時は Cache.fetch で並列を 1 本の count に結合
	localNotesCountCacheMetrics.cacheMisses += 1;
	const count = await localNotesCountCache.fetch(null, async () => {
		const b = performance.now();
		const c = await Notes.count({
			where: { userHost: IsNull(), deletedAt: IsNull() },
		});
		localNotesCountCacheMetrics.dbExecutions += 1;
		localNotesCountCacheMetrics.totalDbLatencyMs += performance.now() - b;
		return c;
	});
	return count;
}

/**
 * ローカルノート件数キャッシュの簡易メトリクスを返す。
 *
 * @returns TTL・ヒット率など
 * @internal
 */
export function getLocalNotesCountCacheMetrics() {
	const totalRequests =
		localNotesCountCacheMetrics.cacheHits +
		localNotesCountCacheMetrics.cacheMisses;

	return {
		ttlMs: LOCAL_NOTES_COUNT_TTL_MS,
		...localNotesCountCacheMetrics,
		cacheHitRate:
			totalRequests > 0
				? localNotesCountCacheMetrics.cacheHits / totalRequests
				: 0,
		averageDbLatencyMs:
			localNotesCountCacheMetrics.dbExecutions > 0
				? localNotesCountCacheMetrics.totalDbLatencyMs /
					localNotesCountCacheMetrics.dbExecutions
				: 0,
	};
}
