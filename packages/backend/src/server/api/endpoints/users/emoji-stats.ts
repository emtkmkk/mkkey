import {
	NoteReactions,
	Users,
} from "@/models/index.js";
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
				}
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
				}
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
				}
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
				}
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
				}
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
				}
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
	if (user == null) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	let now = new Date();
	let borderDate = new Date();

	const RECENTLY_TARGET_DAYS = 14;
	const CACHE_TIME = 300 * 1000;

	borderDate.setDate(now.getDate() - RECENTLY_TARGET_DAYS);
	borderDate.setMinutes(0);
	borderDate.setSeconds(0);
	borderDate.setMilliseconds(0);
	
	const result = await awaitAll({
		sentReactions: NoteReactions.createQueryBuilder("reaction")
			.select(['reaction.reaction', 'COUNT(*) AS cnt'])
			.where("reaction.userId = :userId", { userId: user.id })
			.groupBy('reaction.reaction')
			.cache(CACHE_TIME)
			.getRawMany(),
		sentReactionsCount: NoteReactions.createQueryBuilder("reaction")
			.select('reaction.reaction')
			.where("reaction.userId = :userId", { userId: user.id })
			.andWhere("reaction.reaction ~* '^:[^@]+:$'")
			.groupBy('reaction.reaction')
			.cache(CACHE_TIME)
			.getCount(),
		receivedReactions: NoteReactions.createQueryBuilder("reaction")
			.select(['reaction.reaction', 'COUNT(*) AS cnt'])
			.innerJoin("reaction.note", "note")
			.where("note.userId = :userId", { userId: user.id })
			.groupBy('reaction.reaction')
			.cache(CACHE_TIME)
			.getRawMany(),
		receivedReactionsCount: NoteReactions.createQueryBuilder("reaction")
			.select('reaction.reaction')
			.innerJoin("reaction.note", "note")
			.where("note.userId = :userId", { userId: user.id })
			.andWhere("reaction.reaction ~* '^:[^@]+:$'")
			.groupBy('reaction.reaction')
			.cache(CACHE_TIME)
			.getCount(),
		recentlySentReactions: NoteReactions.createQueryBuilder("reaction")
			.select(['reaction.reaction', 'COUNT(*) AS cnt'])
			.where("reaction.userId = :userId", { userId: user.id })
			.andWhere("reaction.createdAt >= :borderDate", { borderDate: borderDate.toISOString() })
			.groupBy('reaction.reaction')
			.cache(CACHE_TIME)
			.getRawMany(),
		recentlyReceivedReactionsCount: NoteReactions.createQueryBuilder("reaction")
			.select(['reaction.reaction', 'COUNT(*) AS cnt'])
			.innerJoin("reaction.note", "note")
			.where("note.userId = :userId", { userId: user.id })
			.andWhere("reaction.createdAt >= :borderDate", { borderDate: borderDate.toISOString() })
			.groupBy('reaction.reaction')
			.cache(CACHE_TIME)
			.getRawMany(),
	});

	return result;
});
