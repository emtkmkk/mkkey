import { getJsonSchema } from "@/services/chart/core.js";
import define from "../../define.js";

export const meta = {
	tags: ["charts", "hashtags"],
	requireCredentialPrivateMode: true,

	res: null,

	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		span: { type: "string", enum: ["day", "hour"] },
		limit: { type: "integer", minimum: 1, maximum: 500, default: 30 },
		offset: { type: "integer", nullable: true, default: null },
		tag: { type: "string" },
	},
	required: ["span", "tag"],
} as const;

export default define(meta, paramDef, async (ps) => {
	return null;
});
