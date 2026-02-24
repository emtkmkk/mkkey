/**
 * @packageDocumentation
 *
 * パフォーマンスインシデントに対して管理者が手動で AI 分析を実行する API エンドポイント。
 * OpenAI API キーが設定されている場合のみ利用可能。
 *
 * @internal
 */

import define from "../../define.js";
import { ApiError } from "../../error.js";
import { db } from "@/db/postgre.js";
import { analyzePerformanceIncident } from "@/services/performance/ai-analysis.js";

export const meta = {
	requireCredential: true,
	requireModerator: true,

	tags: ["admin"],

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			aiAnalysis: {
				type: "string",
				optional: false,
				nullable: true,
			},
			error: {
				type: "object",
				optional: true,
				nullable: false,
				properties: {
					message: { type: "string" },
					code: { type: "string" },
					id: { type: "string" },
					kind: { type: "string" },
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		/** UUID（performance_incident の id） */
		incidentId: { type: "string" },
	},
	required: ["incidentId"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const rows = await db.query(
		`SELECT "id", "severity", "metric", "value", "stats"
		 FROM "performance_incident"
		 WHERE "id" = $1`,
		[ps.incidentId],
	);

	const incident = rows[0];
	if (!incident) {
		throw new ApiError({
			message: "指定されたインシデントが見つかりません。",
			code: "NO_SUCH_INCIDENT",
			id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			httpStatusCode: 404,
		});
	}

	const stats =
		typeof incident.stats === "object" && incident.stats !== null
			? (incident.stats as Record<string, unknown>)
			: {};

	const result = await analyzePerformanceIncident(
		incident.severity,
		incident.metric,
		Number(incident.value),
		stats,
	);

	if (!result.ok) {
		const messages: Record<typeof result.code, string> = {
			NO_API_KEY:
				"AI分析に失敗しました。設定でOpenAI APIキーが登録されているか確認してください。",
			RATE_LIMIT:
				"OpenAI APIのレート制限に達しました。しばらく待ってから再試行してください。",
			AUTH_ERROR:
				"OpenAI APIの認証に失敗しました。APIキーが正しいか、有効期限を確認してください。",
			NOT_FOUND:
				"OpenAI APIのURLが見つかりません（404）。管理画面の「OpenAI API ベースURL」が正しいか確認してください。例: https://api.openai.com/v1",
			BAD_REQUEST:
				"OpenAI APIがリクエストを拒否しました（400）。管理画面の「OpenAI モデル名」が利用可能か、ベースURLがチャット完了APIに対応しているか確認してください。",
			INVALID_RESPONSE:
				"AI分析に失敗しました。OpenAI APIのレスポンス形式に問題がある可能性があります。",
			NETWORK_ERROR:
				"AI分析に失敗しました。ネットワークエラーまたはタイムアウトの可能性があります。",
			API_ERROR:
				"AI分析に失敗しました。OpenAI APIの利用可否を確認してください。",
		};
		return {
			aiAnalysis: null,
			error: {
				message: messages[result.code],
				code: "AI_ANALYSIS_FAILED",
				id: "b2c3d4e5-f6a7-8901-bcde-f23456789012",
				kind: "server",
			},
		};
	}

	await db.query(
		`UPDATE "performance_incident" SET "aiAnalysis" = $1 WHERE "id" = $2`,
		[result.analysis, ps.incidentId],
	);

	return { aiAnalysis: result.analysis };
});
