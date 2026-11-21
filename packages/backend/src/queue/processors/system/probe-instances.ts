/**
 * @packageDocumentation
 *
 * 自動停止中の配送先サーバに生存確認（nodeinfo の取得）を送り、生きていれば停止を解除する定期ジョブ。
 *
 * @remarks
 * - **役割**: 旧 `check-suspended-instances`（1 日 1 回・応答が無いと永久に放置）の置き換え。
 * - 10 分ごとに、`nextProbeAt` を過ぎた自動停止中のサーバを最大 {@link BATCH_SIZE} 件確かめる。
 *   失敗したら間隔を 1 時間から倍々に延ばし（上限 1 日）、打ち切らない（{@link recordProbeFailure}）。
 * - 閉鎖停止（サーバ自体が 410）と手動停止は確かめない（計画の決定事項 Q7、手動は人が判断する）。
 *
 * @see plans/instance-delivery-health-plan.md 設計方針 4
 * @internal
 */
import type Bull from "bull";
import pLimit from "p-limit";
import { LessThanOrEqual } from "typeorm";
import { Instances } from "@/models/index.js";
import { probeNodeinfo } from "@/services/instance-health/probe.js";
import {
	noteHostAlive,
	recordProbeFailure,
} from "@/services/instance-health/state.js";
import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("probe-instances");

/** 1 回のジョブで確かめる最大件数 */
const BATCH_SIZE = 50;

/** 同時に確かめる数 */
const CONCURRENCY = 5;

/**
 * 自動停止中のサーバを確かめる。
 *
 * @param job - Bull ジョブ
 * @returns 結果の説明
 * @internal
 */
export async function probeInstances(
	job: Bull.Job<Record<string, unknown>>,
): Promise<string> {
	const targets = await Instances.find({
		select: ["id", "host", "probeFailures"],
		where: {
			suspensionState: "autoSuspendedForNotResponding",
			nextProbeAt: LessThanOrEqual(new Date()),
		},
		order: { nextProbeAt: "ASC" },
		take: BATCH_SIZE,
	});
	if (targets.length === 0) return "no targets";

	const limit = pLimit(CONCURRENCY);
	let recovered = 0;

	await Promise.allSettled(
		targets.map((inst) =>
			limit(async () => {
				const result = await probeNodeinfo(inst.host);
				if (result.alive) {
					await noteHostAlive(inst.host, "probe", {
						url: result.url,
						statusCode: result.statusCode,
						probeFailures: inst.probeFailures,
					});
					recovered++;
					job.log(`succ - recovered ${inst.host}`);
				} else {
					await recordProbeFailure(inst, result.label ?? "unknown");
				}
			}).catch((e) => {
				logger.warn(`probe failed for ${inst.host}: ${e}`);
			}),
		),
	);

	const summary = `probed ${targets.length}, recovered ${recovered}`;
	logger.info(summary);
	return summary;
}
