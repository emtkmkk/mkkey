import { redisClient } from "@/db/redis.js";
import define from "../../../define.js";
import { RegistryItems } from "@/models/index.js";

export const REGISTRY_GET_ALL_CACHE_PREFIX = "registry:get-all:";
const REGISTRY_GET_ALL_CACHE_TTL_SEC = 300; // 5分

/**
 * set/remove 時に該当ユーザの get-all キャッシュを無効化する。
 * KEYS ではなく SCAN でキーを列挙し、Redis のブロックを避ける。
 */
export async function invalidateRegistryGetAllCacheForUser(userId: string): Promise<void> {
	const pattern = `${REGISTRY_GET_ALL_CACHE_PREFIX}${userId}:*`;
	const keys: string[] = [];
	let cursor = "0";
	do {
		const [nextCursor, found] = await redisClient.scan(
			cursor,
			"MATCH",
			pattern,
			"COUNT",
			100,
		);
		cursor = nextCursor;
		keys.push(...found);
	} while (cursor !== "0");
	if (keys.length > 0) {
		await redisClient.del(...keys);
	}
}

function getCacheKey(userId: string, scope: string[]): string {
	const scopeKey = [...scope].sort().join(",");
	return `${REGISTRY_GET_ALL_CACHE_PREFIX}${userId}:${scopeKey}`;
}

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		scope: {
			type: "array",
			default: [],
			items: {
				type: "string",
				pattern: /^[a-zA-Z0-9_]+$/.toString().slice(1, -1),
			},
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const sortedScope = [...ps.scope].sort();
	const cacheKey = getCacheKey(user.id, sortedScope);
	const cached = await redisClient.get(cacheKey);
	if (cached != null) {
		return JSON.parse(cached) as Record<string, any>;
	}

	const query = RegistryItems.createQueryBuilder("item")
		.where("item.domain IS NULL")
		.andWhere("item.userId = :userId", { userId: user.id })
		.andWhere("item.scope = :scope", { scope: sortedScope });

	const items = await query.getMany();

	const res = {} as Record<string, any>;

	for (const item of items) {
		res[item.key] = item.value;
	}

	await redisClient.set(cacheKey, JSON.stringify(res), "EX", REGISTRY_GET_ALL_CACHE_TTL_SEC);

	return res;
});
