import { NoteReactions, Users } from "@/models/index.js";
import { awaitAll } from "@/prelude/await-all.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "Show statistics about a user.",

	errors: {
		noSuchUser: {
			message: "No such user.",
			code: "NO_SUCH_USER",
			id: "9e638e45-3b25-4ef7-8f95-07e8498f1819",
		},
	},

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
			receivedReactions: {
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
			receivedReactionsCount: {
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
			recentlyReceivedReactions: {
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
		userId: { type: "string", format: "misskey:id" },
		limit: { type: "integer" },
		localOnly: { type: "boolean", default: false },
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

	const result = await awaitAll({
		sentReactions: NoteReactions.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.where(`(reaction.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		sentReactionsCount: (
			await NoteReactions.createQueryBuilder("reaction")
				.select("reaction.reaction")
				.where(`(reaction.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
					userId: user.id,
				})
				.andWhere("reaction.reaction ~ '^:[^@]+:$'")
				.groupBy("reaction.reaction")
				.cache(CACHE_TIME)
				.getRawMany()
		).length,
		receivedReactions: NoteReactions.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.innerJoin("reaction.note", "note")
			.where(`(note.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		receivedReactionsCount: (
			await NoteReactions.createQueryBuilder("reaction")
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
		recentlySentReactions: NoteReactions.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.where(`(reaction.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere("reaction.createdAt >= :borderDate", {
				borderDate: borderDate.toISOString(),
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.groupBy("reaction.reaction")
			.orderBy("count", "DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		recentlyReceivedReactions: NoteReactions.createQueryBuilder("reaction")
			.select(["reaction.reaction AS name", "COUNT(*) AS count"])
			.innerJoin("reaction.note", "note")
			.where(`(note.userId = :userId${!user.id ? " OR TRUE)" : ")"}`, {
				userId: user.id,
			})
			.andWhere("reaction.createdAt >= :borderDate", {
				borderDate: borderDate.toISOString(),
			})
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
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
