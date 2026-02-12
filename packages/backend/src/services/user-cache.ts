import { createHash } from "node:crypto";
import type {
	CacheableLocalUser,
	CacheableUser,
	ILocalUser,
} from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import { Cache } from "@/misc/cache.js";
import { redisClient, subscriber } from "@/db/redis.js";

const LOCAL_MAP_TTL_MS = 30 * 1000;
const USER_CACHE_REDIS_TTL_SEC = 60;

const USER_BY_ID_REDIS_KEY_PREFIX = "user-cache:user-by-id";
const LOCAL_USER_BY_NATIVE_TOKEN_REDIS_KEY_PREFIX =
	"user-cache:local-user-by-native-token";
const AUTH_USER_BY_TOKEN_REDIS_KEY_PREFIX = "auth:userByToken";
const LOCAL_USER_BY_ID_REDIS_KEY_PREFIX = "user-cache:local-user-by-id";
const URI_PERSON_REDIS_KEY_PREFIX = "user-cache:uri-person";

function createRedisKey(prefix: string, key: string | null): string {
	return `${prefix}:${key ?? "__null__"}`;
}

function createTokenHash(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function reviveCachedUserDates<T>(value: T): T {
	if (value == null || typeof value !== "object") return value;

	const user = value as Record<string, unknown>;
	for (const key of [
		"createdAt",
		"updatedAt",
		"lastFetchedAt",
		"lastActiveDate",
		"birthday",
	] as const) {
		const dateValue = user[key];
		if (dateValue == null || dateValue instanceof Date) continue;

		const parsed = new Date(dateValue as string | number);
		if (!Number.isNaN(parsed.getTime())) {
			user[key] = parsed;
		}
	}

	return value;
}

async function cacheSetWithRedis<T>(
	cache: Cache<T>,
	redisKeyPrefix: string,
	key: string | null,
	value: T,
): Promise<void> {
	cache.set(key, value);
	await redisClient.set(
		createRedisKey(redisKeyPrefix, key),
		JSON.stringify(value),
		"EX",
		USER_CACHE_REDIS_TTL_SEC,
	);
}

async function cacheDeleteWithRedis(
	cache: Cache<unknown>,
	redisKeyPrefix: string,
	key: string | null,
): Promise<void> {
	cache.delete(key);
	await redisClient.del(createRedisKey(redisKeyPrefix, key));
}

async function fetchThroughRedis<T>(
	cache: Cache<T>,
	redisKeyPrefix: string,
	key: string | null,
	fetcher: () => Promise<T | undefined>,
	validator?: (cachedValue: T) => boolean,
): Promise<T | undefined> {
	const localCached = cache.get(key);
	if (localCached !== undefined && (validator == null || validator(localCached))) {
		return localCached;
	}

	const redisKey = createRedisKey(redisKeyPrefix, key);
	const redisCached = await redisClient.get(redisKey);
	if (redisCached != null) {
		const parsed = reviveCachedUserDates(JSON.parse(redisCached) as T);
		if (validator == null || validator(parsed)) {
			cache.set(key, parsed);
			return parsed;
		}
	}

	const fetched = await fetcher();
	if (fetched !== undefined) {
		await cacheSetWithRedis(cache, redisKeyPrefix, key, fetched);
	}

	return fetched;
}

export const userByIdCache = new Cache<CacheableUser>(LOCAL_MAP_TTL_MS);
export const localUserByNativeTokenCache = new Cache<CacheableLocalUser | null>(
	LOCAL_MAP_TTL_MS,
);
export const authUserByTokenCache = new Cache<CacheableLocalUser | null>(
	LOCAL_MAP_TTL_MS,
);
export const localUserByIdCache = new Cache<CacheableLocalUser>(LOCAL_MAP_TTL_MS);
export const uriPersonCache = new Cache<CacheableUser | null>(LOCAL_MAP_TTL_MS);

export async function fetchUserByIdCacheMaybe(
	id: string,
	fetcher: () => Promise<CacheableUser | undefined>,
): Promise<CacheableUser | undefined> {
	return await fetchThroughRedis(
		userByIdCache,
		USER_BY_ID_REDIS_KEY_PREFIX,
		id,
		fetcher,
	);
}

export async function fetchUserByIdCache(
	id: string,
	fetcher: () => Promise<CacheableUser>,
): Promise<CacheableUser> {
	return (await fetchThroughRedis(
		userByIdCache,
		USER_BY_ID_REDIS_KEY_PREFIX,
		id,
		fetcher,
	)) as CacheableUser;
}

export async function fetchLocalUserByNativeTokenCache(
	token: string,
	fetcher: () => Promise<CacheableLocalUser | null>,
): Promise<CacheableLocalUser | null> {
	return (await fetchThroughRedis(
		localUserByNativeTokenCache,
		LOCAL_USER_BY_NATIVE_TOKEN_REDIS_KEY_PREFIX,
		token,
		fetcher,
	)) as CacheableLocalUser | null;
}

export async function fetchAuthUserByTokenCache(
	token: string,
	fetcher: () => Promise<CacheableLocalUser | null>,
): Promise<CacheableLocalUser | null> {
	const tokenHash = createTokenHash(token);
	const localCached = authUserByTokenCache.get(tokenHash);
	if (localCached !== undefined) {
		return localCached;
	}

	const redisKey = createRedisKey(AUTH_USER_BY_TOKEN_REDIS_KEY_PREFIX, tokenHash);
	const redisCached = await redisClient.get(redisKey);
	if (redisCached != null) {
		const parsed = reviveCachedUserDates(
			JSON.parse(redisCached) as CacheableLocalUser | null,
		);
		authUserByTokenCache.set(tokenHash, parsed);
		return parsed;
	}

	const fetched = await fetcher();
	if (fetched !== undefined) {
		authUserByTokenCache.set(tokenHash, fetched);
		await redisClient.set(
			redisKey,
			JSON.stringify(fetched),
			"EX",
			USER_CACHE_REDIS_TTL_SEC,
		);
	}

	return fetched;
}

export async function fetchLocalUserByIdCache(
	id: string,
	fetcher: () => Promise<CacheableLocalUser>,
): Promise<CacheableLocalUser> {
	return (await fetchThroughRedis(
		localUserByIdCache,
		LOCAL_USER_BY_ID_REDIS_KEY_PREFIX,
		id,
		fetcher,
	)) as CacheableLocalUser;
}

export async function fetchUriPersonCache(
	uri: string,
	fetcher: () => Promise<CacheableUser | null>,
): Promise<CacheableUser | null> {
	return (await fetchThroughRedis(
		uriPersonCache,
		URI_PERSON_REDIS_KEY_PREFIX,
		uri,
		fetcher,
	)) as CacheableUser | null;
}

subscriber.on("message", async (_, data) => {
	const obj = JSON.parse(data);

	if (obj.channel === "internal") {
		const { type, body } = obj.message;
		switch (type) {
			case "localUserUpdated": {
				await cacheDeleteWithRedis(userByIdCache, USER_BY_ID_REDIS_KEY_PREFIX, body.id);
				await cacheDeleteWithRedis(localUserByIdCache, LOCAL_USER_BY_ID_REDIS_KEY_PREFIX, body.id);
				const localUser = (await Users.findOneBy({ id: body.id })) as ILocalUser | null;
				if (localUser?.token) {
					const tokenHash = createTokenHash(localUser.token);
					authUserByTokenCache.delete(tokenHash);
					await redisClient.del(
						createRedisKey(AUTH_USER_BY_TOKEN_REDIS_KEY_PREFIX, tokenHash),
					);
				}
				for (const [k, v] of localUserByNativeTokenCache.cache.entries()) {
					if (v.value?.id === body.id) {
						await cacheDeleteWithRedis(
							localUserByNativeTokenCache,
							LOCAL_USER_BY_NATIVE_TOKEN_REDIS_KEY_PREFIX,
							k,
						);
					}
				}
				for (const [k, v] of authUserByTokenCache.cache.entries()) {
					if (v.value?.id === body.id) {
						authUserByTokenCache.delete(k);
						await redisClient.del(
							createRedisKey(AUTH_USER_BY_TOKEN_REDIS_KEY_PREFIX, k),
						);
					}
				}
				break;
			}
			case "userChangeSuspendedState":
			case "userChangeSilencedState":
			case "userChangeModeratorState":
			case "remoteUserUpdated": {
				const user = await Users.findOneByOrFail({ id: body.id });
				await cacheSetWithRedis(userByIdCache, USER_BY_ID_REDIS_KEY_PREFIX, user.id, user);
				for (const [k, v] of uriPersonCache.cache.entries()) {
					if (v.value?.id === user.id) {
						await cacheSetWithRedis(uriPersonCache, URI_PERSON_REDIS_KEY_PREFIX, k, user);
					}
				}
				if (Users.isLocalUser(user)) {
					await cacheSetWithRedis(
						localUserByNativeTokenCache,
						LOCAL_USER_BY_NATIVE_TOKEN_REDIS_KEY_PREFIX,
						user.token,
						user,
					);
					await cacheSetWithRedis(
						localUserByIdCache,
						LOCAL_USER_BY_ID_REDIS_KEY_PREFIX,
						user.id,
						user,
					);
				}
				break;
			}
			case "userTokenRegenerated": {
				const user = (await Users.findOneByOrFail({
					id: body.id,
				})) as ILocalUser;
				const oldTokenHash = createTokenHash(body.oldToken);
				authUserByTokenCache.delete(oldTokenHash);
				await redisClient.del(
					createRedisKey(AUTH_USER_BY_TOKEN_REDIS_KEY_PREFIX, oldTokenHash),
				);
				const newTokenHash = createTokenHash(body.newToken);
				authUserByTokenCache.delete(newTokenHash);
				await redisClient.del(
					createRedisKey(AUTH_USER_BY_TOKEN_REDIS_KEY_PREFIX, newTokenHash),
				);
				await cacheDeleteWithRedis(
					localUserByNativeTokenCache,
					LOCAL_USER_BY_NATIVE_TOKEN_REDIS_KEY_PREFIX,
					body.oldToken,
				);
				await cacheSetWithRedis(
					localUserByNativeTokenCache,
					LOCAL_USER_BY_NATIVE_TOKEN_REDIS_KEY_PREFIX,
					body.newToken,
					user,
				);
				break;
			}
			default:
				break;
		}
	}
});
