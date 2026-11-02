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

/** 内訳チェック結果のプロパティ。reason は成功時に省略されるため optional */
const healthComponentProperties = {
	...healthCommonProperties,
	reason: {
		type: "string",
		optional: true,
		nullable: true,
		description: "失敗時の要約理由（成功時は省略）。",
	},
} as const;

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
				// NOTE: 内訳は runBackendCheck が返したものをそのまま載せるため、各項目は省略されうる。
				// 内訳側の reason は成功時に省略される（トップレベルのように null で補っていない）。
				properties: {
					db: {
						type: "object",
						optional: true,
						nullable: false,
						description: "DB チェック結果。",
						properties: healthComponentProperties,
					},
					redis: {
						type: "object",
						optional: true,
						nullable: false,
						description: "Redis チェック結果。",
						properties: healthComponentProperties,
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
