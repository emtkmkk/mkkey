import { db } from "@/db/postgre.js";
import define from "../../define.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	await db.query(`DELETE FROM "performance_incident"`);

	return {
		deleted: true,
	};
});
