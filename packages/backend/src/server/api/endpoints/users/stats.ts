/**
 * @packageDocumentation
 *
 * ユーザーごとの統計（投稿数・リアクション数・ランク等）を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/stats`（GET `/api/users/stats` で呼び出し）
 * - 認証は不要（userId 指定で対象ユーザーの統計を返す）。
 * - ユーザーごとの投稿数・リアクション数・ランクなどの統計を返す。
 * - 応答は in-memory キャッシュで 10 分間保持し、同一キーへの再リクエストでは DB を叩かずに返す。
 * - config.db.statsUser が設定されている場合は集計専用接続プールを使用する（集計サービス経由）。
 * - DB 集計は {@link fetchUserStatsAggregates}、パワー・ランク数式は `@/services/user-power.js` に集約。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Users } from "@/models/index.js";
import { Cache } from "@/misc/cache.js";
import {
	buildUserStatsResultFromAggregates,
	fetchUserStatsAggregates,
} from "@/services/user-stats/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";

/** 応答全体のキャッシュ（TTL 10 分）。キー: userId:simple */
const STATS_RESPONSE_CACHE_TTL_MS = 600 * 1000;
const statsResponseCache = new Cache<Record<string, unknown>>(
	STATS_RESPONSE_CACHE_TTL_MS,
);

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "指定ユーザーのフォロワー数・ノート数等の統計を取得します。",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "9e638e45-3b25-4ef7-8f95-07e8498f1819",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			notesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			repliesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			renotesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			repliedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			renotedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pollVotesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pollVotedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			localFollowingCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			remoteFollowingCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			localFollowersCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			remoteFollowersCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			followingCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			followersCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			sentReactionsCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			receivedReactionsCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			noteFavoritesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pageLikesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pageLikedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			driveFilesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			driveUsage: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "ドライブ使用量（バイト単位）",
			},
			notesPostDays: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "1 件以上ノートを投稿した日数",
			},
			power: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "パワー値（内部指標）",
			},
			powerRank: {
				type: "string",
				optional: false,
				nullable: false,
				description: "パワーランク（内部指標）",
			},
			nextRank: {
				type: "string",
				optional: false,
				nullable: false,
				description: "次ランク（内部指標）",
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });
	if (user == null || !user.id) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	const simple = Boolean((ps as { simple?: boolean }).simple);
	const cacheKey = `${ps.userId}:${String(simple)}`;
	const cached = statsResponseCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	const aggregates = await fetchUserStatsAggregates({
		user,
		simple,
		includeInviteCount: Boolean(
			me && (me.id === user.id || me.isAdmin),
		),
	});

	const { result, effectiveRankPowerFloored } =
		buildUserStatsResultFromAggregates({
			user,
			simple,
			aggregates,
		});

	// リモートかつローカルフォロワー未検出のときはランク末尾に疑問符（従来仕様）
	const firstLocalFollowerMs = aggregates.firstLocalFollowerMs;
	if (!firstLocalFollowerMs && user.host) {
		result.powerRank = `${result.powerRank}?`;
	}

	// ローカルまたはローカルフォロワーがいるリモートのみ、集計に基づき User を更新
	if (!(!firstLocalFollowerMs && user.host)) {
		const updates: Record<string, number> = {};
		const notesCount = aggregates.primaryRow.notesCount;
		if (user.notesCount !== notesCount && !user.host) {
			updates.notesCount = notesCount;
		}
		if (user.maxRankPoint < effectiveRankPowerFloored) {
			updates.maxRankPoint = effectiveRankPowerFloored;
		}
		const powerVal = result.power as number;
		if (user.maxPower < powerVal) {
			updates.maxPower = powerVal;
		}
		if (Object.keys(updates).length > 0) {
			await Users.update(user.id, updates);
		}
	}

	statsResponseCache.set(cacheKey, result);
	return result;
});
