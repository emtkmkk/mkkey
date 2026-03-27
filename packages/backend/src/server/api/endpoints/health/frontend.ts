/**
 * @packageDocumentation
 *
 * フロントエンド配信準備状態を確認するヘルスチェックエンドポイント。
 *
 * @remarks
 * - API パス: `health/frontend`（GET `/api/health/frontend`）
 * - JS 実行エラーは監視せず、サーバ側で確認できる範囲（client entry 解決と配信ファイル存在）を判定する。
 * - 結果は 1 分キャッシュされる。
 *
 * @internal
 */
import define from "../../define.js";
import { runFrontendCheck } from "@/server/api/health/checks.js";
import { healthCommonProperties } from "./schema.js";

export const meta = {
	requireCredential: false,
	allowGet: true,
	tags: ["meta"],
	description: "フロントエンド配信準備ヘルスチェックです。",
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
	const result = await runFrontendCheck();
	return {
		...result,
		reason: result.reason ?? null,
	};
});
