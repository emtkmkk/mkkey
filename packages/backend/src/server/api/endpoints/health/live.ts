/**
 * @packageDocumentation
 *
 * プロセス生存確認用のヘルスチェックエンドポイント。
 *
 * @remarks
 * - API パス: `health/live`（GET `/api/health/live`）
 * - 生存確認のみを返す。キャッシュしない。
 *
 * @internal
 */
import define from "../../define.js";
import { runLiveCheck } from "@/server/api/health/checks.js";
import { healthCommonProperties } from "./schema.js";

export const meta = {
	requireCredential: false,
	allowGet: true,
	tags: ["meta"],
	description: "プロセス生存確認用ヘルスチェックです。",
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
	const result = runLiveCheck();
	return {
		...result,
		reason: null,
	};
});
