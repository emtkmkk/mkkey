/**
 * @packageDocumentation
 *
 * DB 健全性（インスタンス情報読込）を確認するヘルスチェックエンドポイント。
 *
 * @remarks
 * - API パス: `health/db`（GET `/api/health/db`）
 * - インスタンス情報の読込可否を 60 秒タイムアウトで判定する。
 * - 結果は 1 分キャッシュされる。
 *
 * @internal
 */
import define from "../../define.js";
import { runDbCheck } from "@/server/api/health/checks.js";
import { healthCommonProperties } from "./schema.js";

export const meta = {
	requireCredential: false,
	allowGet: true,
	tags: ["meta"],
	description: "DB 健全性（インスタンス情報読込）ヘルスチェックです。",
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
	const result = await runDbCheck();
	return {
		...result,
		reason: result.reason ?? null,
	};
});
