/**
 * @packageDocumentation
 *
 * 指定したパフォーマンスインシデントに対してAI分析で使用する（または使用した）プロンプトを返す API。
 * 管理画面で「プロンプトをコピー」ボタンから呼び出される。
 *
 * @internal
 */

import define from "../../define.js";
import { ApiError } from "../../error.js";
import { db } from "@/db/postgre.js";
import { getPerformanceIncidentPrompt } from "@/services/performance/ai-analysis.js";

export const meta = {
	requireCredential: true,
	requireModerator: true,
	kind: "read:admin:performance",

	tags: ["admin"],

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			systemPrompt: { type: "string" },
			userPrompt: { type: "string" },
			/** コピー用に結合した全文（システム＋ユーザー） */
			prompt: { type: "string" },
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

	const { systemPrompt, userPrompt } = getPerformanceIncidentPrompt(
		incident.severity,
		incident.metric,
		Number(incident.value),
		stats,
	);

	const prompt = `【システムプロンプト】\n${systemPrompt}\n\n【ユーザープロンプト】\n${userPrompt}`;

	return { systemPrompt, userPrompt, prompt };
});
