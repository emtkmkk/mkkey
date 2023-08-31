import {
	NoteReactions,
} from "@/models/index.js";
import { awaitAll } from "@/prelude/await-all.js";
import define from "../../define.js";

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
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: {type: "integer"},
		localOnly: {type: "boolean", default: false},
	},
} as const;

export default define(meta, paramDef, async (ps, me) => {

	let now = new Date();
	let borderDate = new Date();
	
	const limit = ps.limit;

	const RECENTLY_TARGET_DAYS = 14;
	const CACHE_TIME = 30 * 60 * 1000;

	borderDate.setDate(now.getDate() - RECENTLY_TARGET_DAYS);
	borderDate.setMinutes(0);
	borderDate.setSeconds(0);
	borderDate.setMilliseconds(0);
	
	const result = await awaitAll({
		sentReactions: NoteReactions.createQueryBuilder("reaction")
			.select(['reaction.reaction AS name', 'COUNT(*) AS count'])
			.where(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.groupBy('reaction.reaction')
			.orderBy("count","DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
		sentReactionsCount: (await NoteReactions.createQueryBuilder("reaction")
			.select('reaction.reaction')
			.where("reaction.reaction ~ '^:[^@]+:$'")
			.groupBy('reaction.reaction')
			.cache(CACHE_TIME)
			.getRawMany()).length,
		recentlySentReactions: NoteReactions.createQueryBuilder("reaction")
			.select(['reaction.reaction AS name', 'COUNT(*) AS count'])
			.where("reaction.createdAt >= :borderDate", { borderDate: borderDate.toISOString() })
			.andWhere(ps.localOnly ? "reaction.reaction ~ '^:[^@]+:$'" : "TRUE")
			.groupBy('reaction.reaction')
			.orderBy("count","DESC")
			.cache(CACHE_TIME)
			.getRawMany(),
	});

	if (limit){
		result.sentReactions = result.sentReactions.slice(0,limit)
		result.recentlySentReactions = result.recentlySentReactions.slice(0,limit)
	}
	return result;
});
