import { getJsonSchema } from "@/services/chart/core.js";
import { usersChart } from "@/services/chart/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["charts", "users"],
	requireCredentialPrivateMode: true,

	res: getJsonSchema(usersChart.schema),

	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		span: { type: "string", enum: ["day", "hour"] },
		limit: { type: "integer", minimum: 1, maximum: 500, default: 30 },
		offset: { type: "integer", nullable: true, default: null },
	},
	required: ["span"],
} as const;


export default define(meta, paramDef, async (ps) => {
	return await usersChart.getChart(
		ps.span,
		ps.limit,
		ps.offset ? new Date(ps.offset) : null,
	);
});
