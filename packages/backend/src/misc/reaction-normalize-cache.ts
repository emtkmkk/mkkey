import { redisClient } from "@/db/redis.js";

const REACTION_NORMALIZE_CACHE_VERSION_KEY = "reaction-normalize:version";
const REACTION_NORMALIZE_CACHE_TTL_SEC = 60;

function encodeCachePart(value: string): string {
	return encodeURIComponent(value);
}

export function buildReactionNormalizeCacheKey(
	version: number,
	userHost: string | null | undefined,
	noteUserHost: string | null | undefined,
	rawReaction: string | null | undefined,
): string {
	return [
		"reaction-normalize",
		`v${version}`,
		encodeCachePart(userHost ?? "_local"),
		encodeCachePart(noteUserHost ?? "_local"),
		encodeCachePart(rawReaction ?? "_empty"),
	].join(":");
}

export async function getReactionNormalizeCacheVersion(): Promise<number> {
	const cachedVersion = await redisClient.get(REACTION_NORMALIZE_CACHE_VERSION_KEY);
	const version = Number(cachedVersion);
	if (Number.isInteger(version) && version > 0) {
		return version;
	}

	await redisClient.set(REACTION_NORMALIZE_CACHE_VERSION_KEY, "1");
	return 1;
}

export async function getCachedNormalizedReaction(
	userHost: string | null | undefined,
	noteUserHost: string | null | undefined,
	rawReaction: string | null | undefined,
): Promise<string | null> {
	const version = await getReactionNormalizeCacheVersion();
	const cacheKey = buildReactionNormalizeCacheKey(
		version,
		userHost,
		noteUserHost,
		rawReaction,
	);

	return await redisClient.get(cacheKey);
}

export async function setCachedNormalizedReaction(
	userHost: string | null | undefined,
	noteUserHost: string | null | undefined,
	rawReaction: string | null | undefined,
	normalizedReaction: string,
): Promise<void> {
	const version = await getReactionNormalizeCacheVersion();
	const cacheKey = buildReactionNormalizeCacheKey(
		version,
		userHost,
		noteUserHost,
		rawReaction,
	);

	await redisClient.set(cacheKey, normalizedReaction, "EX", REACTION_NORMALIZE_CACHE_TTL_SEC);
}

export async function bumpReactionNormalizeCacheVersion(): Promise<void> {
	await redisClient.incr(REACTION_NORMALIZE_CACHE_VERSION_KEY);
}
