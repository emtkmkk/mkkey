/**
 * @packageDocumentation
 *
 * 認証ユーザーのレジストリ（キー値ストア）を一括取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/registry/get-all`（GET `/api/i/registry/get-all` で呼び出し）
 * - 認証必須。スコープで絞ったレジストリキー・値をまとめて返す。キャッシュ 5 分。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
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

	description:
		"レジストリの指定スコープ内のキー・値をまとめて取得する。scope を空にするとクライアント用の共通領域全体。結果はキャッシュされる。",
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
			description:
				"スコープの配列。指定したスコープに一致するキー・値だけを返す。空ならクライアント用の共通領域全体。",
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const cacheKey = getCacheKey(user.id, ps.scope);
	const cached = await redisClient.get(cacheKey);
	if (cached != null) {
		return JSON.parse(cached) as Record<string, any>;
	}

	const query = RegistryItems.createQueryBuilder("item")
		.where("item.domain IS NULL")
		.andWhere("item.userId = :userId", { userId: user.id })
		.andWhere("item.scope = :scope", { scope: ps.scope });

	const items = await query.getMany();

	const res = {} as Record<string, any>;

	for (const item of items) {
		res[item.key] = item.value;
	}

	await redisClient.set(cacheKey, JSON.stringify(res), "EX", REGISTRY_GET_ALL_CACHE_TTL_SEC);

	return res;
});
