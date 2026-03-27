/**
 * @packageDocumentation
 *
 * バックエンド総合（DB/Redis）を確認するヘルスチェックエンドポイント。
 *
 * @remarks
 * - API パス: `health/backend`（GET `/api/health/backend`）
 * - `db` / `redis` の結果を集約して返す。
 * - 結果は 1 分キャッシュされる。
 *
 * @internal
 */
import define from "../../define.js";
import { runBackendCheck } from "@/server/api/health/checks.js";
import { healthCommonProperties } from "./schema.js";

export const meta = {
	requireCredential: false,
	allowGet: true,
	tags: ["meta"],
	description: "バックエンド総合ヘルスチェックです。",
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			...healthCommonProperties,
			components: {
				type: "object",
				optional: true,
				nullable: false,
				description: "内訳チェック結果。",
				properties: {
					db: {
						type: "object",
						optional: false,
						nullable: false,
						description: "DB チェック結果。",
						properties: healthCommonProperties,
					},
					redis: {
						type: "object",
						optional: false,
						nullable: false,
						description: "Redis チェック結果。",
						properties: healthCommonProperties,
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
	const result = await runBackendCheck();
	return {
		...result,
		reason: result.reason ?? null,
		components: result.components ?? {},
	};
});
