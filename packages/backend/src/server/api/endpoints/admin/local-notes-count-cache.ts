import define from "../../define.js";
import {
	getLocalNotesCount,
	getLocalNotesCountCacheMetrics,
} from "@/services/note/local-notes-count-cache.js";

export const meta = {
	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:maintenance",

	tags: ["admin", "meta"],

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			strictCount: {
				type: "number",
				optional: false,
				nullable: false,
			},
			cachedCount: {
				type: "number",
				optional: false,
				nullable: false,
			},
			cacheMetrics: {
				type: "object",
				optional: false,
				nullable: false,
				properties: {
					ttlMs: { type: "number", optional: false, nullable: false },
					cacheHits: { type: "number", optional: false, nullable: false },
					cacheMisses: { type: "number", optional: false, nullable: false },
					dbExecutions: { type: "number", optional: false, nullable: false },
					totalDbLatencyMs: {
						type: "number",
						optional: false,
						nullable: false,
					},
					cacheHitRate: {
						type: "number",
						optional: false,
						nullable: false,
					},
					averageDbLatencyMs: {
						type: "number",
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
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	const [strictCount, cachedCount] = await Promise.all([
		getLocalNotesCount({ strict: true }),
		getLocalNotesCount(),
	]);

	return {
		strictCount,
		cachedCount,
		cacheMetrics: getLocalNotesCountCacheMetrics(),
	};
});
