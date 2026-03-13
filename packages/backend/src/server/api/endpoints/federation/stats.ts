/**
 * @packageDocumentation
 *
 * フェデレーション統計（インスタンス一覧・フォロワー数等）を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `federation/stats`（GET `/api/federation/stats` で呼び出し）
 * - 認証不要。フォロワー数上位のリモートインスタンス一覧等を返す。MV から取得する場合あり。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { IsNull, MoreThan, Not } from "typeorm";
import { getStatsDataSource } from "@/db/postgre.js";
import type { Instance } from "@/models/entities/instance.js";
import { Followings, Instances } from "@/models/index.js";
import { awaitAll } from "@/prelude/await-all.js";
import define from "../../define.js";

/** federation/stats 用 MV からトップ一覧を取得。MV が無い／失敗時は null。 */
async function fetchTopSubFromMv(limit: number): Promise<Instance[] | null> {
	try {
		const ds = getStatsDataSource();
		const rows = await ds.query(
			'SELECT * FROM mv_federation_top_by_followers ORDER BY "followersCount" DESC LIMIT $1',
			[limit],
		) as Instance[];
		return Array.isArray(rows) ? rows : null;
	} catch {
		return null;
	}
}

async function fetchTopPubFromMv(limit: number): Promise<Instance[] | null> {
	try {
		const ds = getStatsDataSource();
		const rows = await ds.query(
			'SELECT * FROM mv_federation_top_by_following ORDER BY "followingCount" DESC LIMIT $1',
			[limit],
		) as Instance[];
		return Array.isArray(rows) ? rows : null;
	} catch {
		return null;
	}
}

export const meta = {
	tags: ["federation"],

	requireCredential: false,

	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const [topSubInstancesRaw, topPubInstancesRaw, allSubCount, allPubCount] =
		await Promise.all([
			fetchTopSubFromMv(ps.limit),
			fetchTopPubFromMv(ps.limit),
			Followings.count({
				where: {
					followeeHost: Not(IsNull()),
				},
			}),
			Followings.count({
				where: {
					followerHost: Not(IsNull()),
				},
			}),
		]);

	const topSubInstances =
		topSubInstancesRaw ??
		(await Instances.find({
			where: { followersCount: MoreThan(0) },
			order: { followersCount: "DESC" },
			take: ps.limit,
		}));
	const topPubInstances =
		topPubInstancesRaw ??
		(await Instances.find({
			where: { followingCount: MoreThan(0) },
			order: { followingCount: "DESC" },
			take: ps.limit,
		}));

	const gotSubCount = topSubInstances
		.map((x) => x.followersCount)
		.reduce((a, b) => a + b, 0);
	const gotPubCount = topPubInstances
		.map((x) => x.followingCount)
		.reduce((a, b) => a + b, 0);

	return await awaitAll({
		topSubInstances: Instances.packMany(topSubInstances),
		otherFollowersCount: Math.max(0, allSubCount - gotSubCount),
		topPubInstances: Instances.packMany(topPubInstances),
		otherFollowingCount: Math.max(0, allPubCount - gotPubCount),
	});
});
