/**
 * @packageDocumentation
 *
 * Redis 健全性（PING）を確認するヘルスチェックエンドポイント。
 *
 * @remarks
 * - API パス: `health/redis`（GET `/api/health/redis`）
 * - Redis PING の成功可否で判定する。
 * - 結果は 1 分キャッシュされる。
 *
 * @internal
 */
import define from "../../define.js";
import { runRedisCheck } from "@/server/api/health/checks.js";
import { healthCommonProperties } from "./schema.js";

export const meta = {
	requireCredential: false,
	allowGet: true,
	tags: ["meta"],
	description: "Redis 健全性（PING）ヘルスチェックです。",
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: healthCommonProperties,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	const result = await runRedisCheck();
	return {
		...result,
		reason: result.reason ?? null,
	};
});
