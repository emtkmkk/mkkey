/**
 * @packageDocumentation
 *
 * 管理用: `pg_indexes` の一覧を返す API。
 *
 * @remarks
 * - **役割**: インデックス一覧を都度 DB から取得する。
 *
 * @internal
 */
import define from "../../define.js";
import { db } from "@/db/postgre.js";

export const meta = {
	requireCredential: true,
	requireModerator: true,

	tags: ["admin"],
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	return await db.query("SELECT * FROM pg_indexes;").then((recs) => {
		const res = [] as { tablename: string; indexname: string }[];
		for (const rec of recs) {
			res.push(rec);
		}
		return res;
	});
});
