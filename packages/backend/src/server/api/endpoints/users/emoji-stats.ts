import { getStatsDataSource } from "@/db/postgre.js";
import { NoteReactions, Users } from "@/models/index.js";
import { NoteReaction } from "@/models/entities/note-reaction.js";
import { awaitAll } from "@/prelude/await-all.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";

/**
 * リアクション 1 種類ぶんの集計行
 *
 * @remarks
 * NB: count は SQL の COUNT(*) をそのまま返しているため、実際の JSON では文字列になることがある（pg の bigint 扱い）。
 *
 * @internal
 */
const reactionCountSchema = {
	type: "object",
	optional: false,
	nullable: false,
	properties: {
		name: {
			type: "string",
			optional: false,
			nullable: false,
			description: "リアクション名（:name: 形式）。",
		},
		count: {
			type: "integer",
			optional: false,
			nullable: false,
			description: "件数。",
		},
	},
} as const;

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "指定ユーザーの絵文字利用統計を取得します。",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "9e638e45-3b25-4ef7-8f95-07e8498f1819",
		},
	},

	// NOTE: 実際の戻り値は「リアクション名と件数の配列」と「種類数」。以前は全項目が object と書かれていて実態と違っていた。
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			sentReactions: {
				type: "array",
				optional: false,
				nullable: false,
				description: "送ったリアクションの種類ごとの件数（件数の多い順）。",
				items: reactionCountSchema,
			},
			sentReactionsCount: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "送ったローカル絵文字リアクションの種類数。",
			},
			receivedReactions: {
				type: "array",
				optional: false,
				nullable: false,
				description: "受け取ったリアクションの種類ごとの件数（件数の多い順）。",
				items: reactionCountSchema,
			},
			receivedReactionsCount: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "受け取ったローカル絵文字リアクションの種類数。",
			},
			recentlySentReactions: {
				type: "array",
				optional: false,
				nullable: false,
				description: "直近 14 日に送ったリアクションの種類ごとの件数。",
				items: reactionCountSchema,
			},
			recentlyReceivedReactions: {
				type: "array",
				optional: false,
				nullable: false,
				description: "直近 14 日に受け取ったリアクションの種類ごとの件数。",
				items: reactionCountSchema,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
		limit: { type: "integer" },
		localOnly: { type: "boolean", default: false },
		remoteOnly: { type: "boolean", default: false },
	},
	//required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	let user = undefined;
	if (ps.userId) {
		user = await Users.findOneBy({ id: ps.userId });
		if (user == null) {
			throw new ApiError(meta.errors.noSuchUser);
		}
	} else {
		user = { id: "" };
	}

	let now = new Date();
	let borderDate = new Date();

	const limit = ps.limit;

	const RECENTLY_TARGET_DAYS = 14;
	const CACHE_TIME = 300 * 1000;

	borderDate.setDate(now.getDate() - RECENTLY_TARGET_DAYS);
	borderDate.setMinutes(0);
	borderDate.setSeconds(0);
	borderDate.setMilliseconds(0);

	const NoteReactionsRepo = getStatsDataSource().getRepository(NoteReaction);

	const result = await awaitAll({
		sentReactions: NoteReactionsRepo.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.where(`(reaction.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.andWhere(
				ps.remoteOnly ? "reaction.reaction ~ '^:[^@]+@[^@]+:$'" : "TRUE",
			)
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		sentReactionsCount: (
			await NoteReactionsRepo.createQueryBuilder("reaction")
				.select("reaction.reaction")
				.where(`(reaction.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
					userId: user.id,
				})
				.andWhere("reaction.reaction ~ '^:[^@]+:$'")
				.groupBy("reaction.reaction")
				.cache(CACHE_TIME)
				.getRawMany()
		).length,
		receivedReactions: NoteReactionsRepo.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.innerJoin("reaction.note", "note")
			.where(`(note.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.andWhere(
				ps.remoteOnly ? "reaction.reaction ~ '^:[^@]+@[^@]+:$'" : "TRUE",
			)
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		receivedReactionsCount: (
			await NoteReactionsRepo.createQueryBuilder("reaction")
				.select("reaction.reaction")
				.innerJoin("reaction.note", "note")
				.where(`(note.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
					userId: user.id,
				})
				.andWhere("reaction.reaction ~ '^:[^@]+:$'")
				.groupBy("reaction.reaction")
				.cache(CACHE_TIME)
				.getRawMany()
		).length,
		recentlySentReactions: NoteReactionsRepo.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.where(`(reaction.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere("reaction.createdAt >= :borderDate", {
				borderDate: borderDate.toISOString(),
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.andWhere(
				ps.remoteOnly ? "reaction.reaction ~ '^:[^@]+@[^@]+:$'" : "TRUE",
			)
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		recentlyReceivedReactions: NoteReactionsRepo.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.innerJoin("reaction.note", "note")
			.where(`(note.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere("reaction.createdAt >= :borderDate", {
				borderDate: borderDate.toISOString(),
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.andWhere(
				ps.remoteOnly ? "reaction.reaction ~ '^:[^@]+@[^@]+:$'" : "TRUE",
			)
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
	});

	if (limit) {
		result.sentReactions = result.sentReactions.slice(0, limit);
		result.receivedReactions = result.receivedReactions.slice(0, limit);
		result.recentlySentReactions = result.recentlySentReactions.slice(0, limit);
		result.recentlyReceivedReactions = result.recentlyReceivedReactions.slice(
			0,
			limit,
		);
	}
	return result;
});
