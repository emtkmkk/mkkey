import { getStatsDataSource } from "@/db/postgre.js";
import { NoteReactions } from "@/models/index.js";
import { awaitAll } from "@/prelude/await-all.js";
import define from "../define.js";

type ReactionRow = { name: string; count: number };

/** limit≤120 かつ localOnly かつ excludeBots のとき MV から取得。失敗時は null。 */
async function fetchRecentlySentReactionsFromMv(
	limit: number | undefined,
): Promise<ReactionRow[] | null> {
	try {
		const ds = getStatsDataSource();
		const rows = await ds.query(
			'SELECT name, count FROM mv_emoji_stats_recently_sent_local_no_bots ORDER BY count DESC',
		) as ReactionRow[];
		if (!Array.isArray(rows)) return null;
		const capped = limit != null && limit > 0 ? rows.slice(0, limit) : rows;
		return capped;
	} catch {
		return null;
	}
}

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "Show statistics.",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			sentReactions: {
				type: "object",
				optional: false,
				nullable: false,
				properties: {
					name: {
						type: "string",
						optional: false,
						nullable: false,
					},
					count: {
						type: "integer",
						optional: false,
						nullable: false,
					},
				},
			},
			sentReactionsCount: {
				type: "object",
				optional: false,
				nullable: false,
				properties: {
					name: {
						type: "string",
						optional: false,
						nullable: false,
					},
					count: {
						type: "integer",
						optional: false,
						nullable: false,
					},
				},
			},
			recentlySentReactions: {
				type: "object",
				optional: false,
				nullable: false,
				properties: {
					name: {
						type: "string",
						optional: false,
						nullable: false,
					},
					count: {
						type: "integer",
						optional: false,
						nullable: false,
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer" },
		localOnly: { type: "boolean", default: false },
		remoteOnly: { type: "boolean", default: false },
		excludeBots: { type: "boolean", default: false },
		recentOnly: { type: "boolean", default: false },
	},
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const limit = ps.limit;
	const useMvForRecently =
		(limit == null || limit <= 120) &&
		ps.localOnly === true &&
		ps.excludeBots === true;

	let recentlySentReactions: ReactionRow[];

	const mvRecently = useMvForRecently
		? await fetchRecentlySentReactionsFromMv(limit ?? 120)
		: null;
	if (mvRecently) {
		recentlySentReactions = mvRecently;
	} else {
		let now = new Date();
		let borderDate = new Date();
		const RECENTLY_TARGET_DAYS = 14;
		const CACHE_TIME = 30 * 60 * 1000;
		borderDate.setDate(now.getDate() - RECENTLY_TARGET_DAYS);
		borderDate.setMinutes(0);
		borderDate.setSeconds(0);
		borderDate.setMilliseconds(0);
		recentlySentReactions = (await NoteReactions.createQueryBuilder("reaction")
			.innerJoin("reaction.user", "user")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.where("reaction.createdAt >= :borderDate", {
				borderDate: borderDate.toISOString(),
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.andWhere(
				ps.remoteOnly ? "reaction.reaction ~ '^:[^@]+@[^@]+:$'" : "TRUE",
			)
			.andWhere(ps.excludeBots ? "user.isBot = FALSE" : "TRUE")
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany()) as ReactionRow[];
		if (limit != null && limit > 0) {
			recentlySentReactions = recentlySentReactions.slice(0, limit);
		}
	}

	if (ps.recentOnly) {
		return {
			sentReactions: [],
			sentReactionsCount: 0,
			recentlySentReactions,
		} as any;
	}

	const RECENTLY_TARGET_DAYS = 14;
	const CACHE_TIME = 30 * 60 * 1000;
	let now = new Date();
	let borderDate = new Date();
	borderDate.setDate(now.getDate() - RECENTLY_TARGET_DAYS);
	borderDate.setMinutes(0);
	borderDate.setSeconds(0);
	borderDate.setMilliseconds(0);

	const [sentReactions, sentReactionsCountRaw] = await Promise.all([
		NoteReactions.createQueryBuilder("reaction")
			.innerJoin("reaction.user", "user")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.where(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.andWhere(
				ps.remoteOnly ? "reaction.reaction ~ '^:[^@]+@[^@]+:$'" : "TRUE",
			)
			.andWhere(ps.excludeBots ? "user.isBot = FALSE" : "TRUE")
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		(
			await NoteReactions.createQueryBuilder("reaction")
				.innerJoin("reaction.user", "user")
				.select("reaction.reaction")
				.where("reaction.reaction ~ '^:[^@]+:$'")
				.andWhere(ps.excludeBots ? "user.isBot = FALSE" : "TRUE")
				.groupBy("reaction.reaction")
				.cache(CACHE_TIME)
				.getRawMany()
		).length,
	]);

	let sentReactionsSliced = sentReactions as ReactionRow[];
	if (limit != null && limit > 0) {
		sentReactionsSliced = sentReactionsSliced.slice(0, limit);
	}

	return {
		sentReactions: sentReactionsSliced,
		sentReactionsCount: sentReactionsCountRaw,
		recentlySentReactions,
	} as any;
});
