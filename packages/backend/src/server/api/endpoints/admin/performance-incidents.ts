import define from "../../define.js";
import { db } from "@/db/postgre.js";

export const meta = {
	requireCredential: true,
	requireModerator: true,

	tags: ["admin"],

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			properties: {
				id: {
					type: "string",
					optional: false,
					nullable: false,
					format: "id",
				},
				createdAt: {
					type: "string",
					optional: false,
					nullable: false,
					format: "date-time",
				},
				severity: {
					type: "string",
					optional: false,
					nullable: false,
				},
				metric: {
					type: "string",
					optional: false,
					nullable: false,
				},
				value: {
					type: "number",
					optional: false,
					nullable: false,
				},
				stats: {
					type: "object",
					optional: false,
					nullable: false,
				},
				aiAnalysis: {
					type: "string",
					optional: false,
					nullable: true,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
		severity: {
			type: "string",
			enum: ["all", "warn", "critical"],
			default: "all",
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const where = ps.severity === "all" ? "" : `WHERE \"severity\" = $2`;
	const params =
		ps.severity === "all"
			? [ps.limit]
			: [ps.limit, ps.severity];

	return await db.query(
		`SELECT "id", "createdAt", "severity", "metric", "value", "stats", "aiAnalysis"
		 FROM "performance_incident"
		 ${where}
		 ORDER BY "createdAt" DESC
		 LIMIT $1`,
		params,
	);
});
