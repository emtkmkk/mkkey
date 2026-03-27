/**
 * @packageDocumentation
 *
 * ストレージ read/write/delete の健全性を確認するヘルスチェックエンドポイント。
 *
 * @remarks
 * - API パス: `health/storage`（GET `/api/health/storage`）
 * - object storage 利用時は PUT/GET/DELETE、ローカル時は write/read/delete を実行する。
 * - 結果は 10 分キャッシュされる。
 *
 * @internal
 */
import define from "../../define.js";
import { runStorageCheck } from "@/server/api/health/checks.js";
import { healthCommonProperties } from "./schema.js";

export const meta = {
	requireCredential: false,
	allowGet: true,
	tags: ["meta"],
	description: "ストレージ read/write/delete ヘルスチェックです。",
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			...healthCommonProperties,
			phases: {
				type: "object",
				optional: true,
				nullable: false,
				description: "フェーズ別処理時間（ミリ秒）。",
				properties: {
					writeMs: {
						type: "number",
						optional: false,
						nullable: false,
						description: "write（保存）処理時間（ミリ秒）。",
					},
					readMs: {
						type: "number",
						optional: false,
						nullable: false,
						description: "read（読取）処理時間（ミリ秒）。",
					},
					deleteMs: {
						type: "number",
						optional: false,
						nullable: false,
						description: "delete（削除）処理時間（ミリ秒）。",
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
	const result = await runStorageCheck();
	return {
		...result,
		reason: result.reason ?? null,
	};
});
