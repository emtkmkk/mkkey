import { Cache } from "@/misc/cache.js";
import { Notes } from "@/models/index.js";
import { IsNull } from "typeorm";

const LOCAL_NOTES_COUNT_TTL_MS = 1000 * 60 * 5;

const localNotesCountCache = new Cache<number>(LOCAL_NOTES_COUNT_TTL_MS);

const localNotesCountCacheMetrics = {
	cacheHits: 0,
	cacheMisses: 0,
	dbExecutions: 0,
	totalDbLatencyMs: 0,
};

export async function getLocalNotesCount(options?: {
	strict?: boolean;
}): Promise<number> {
	if (!options?.strict) {
		const cached = localNotesCountCache.get(null);
		if (cached !== undefined) {
			localNotesCountCacheMetrics.cacheHits += 1;
			return cached;
		}

		localNotesCountCacheMetrics.cacheMisses += 1;
	}

	const before = performance.now();
	const count = await Notes.count({
		where: { userHost: IsNull(), deletedAt: IsNull() },
	});
	const after = performance.now();

	localNotesCountCacheMetrics.dbExecutions += 1;
	localNotesCountCacheMetrics.totalDbLatencyMs += after - before;

	if (!options?.strict) {
		localNotesCountCache.set(null, count);
	}

	return count;
}

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

