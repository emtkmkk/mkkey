/**
 * @packageDocumentation
 *
 * チャート再同期ジョブ。ドライブ・ノート・ユーザー等のチャートを再計算する。
 *
 * @remarks
 * - **役割**: システムキューで実行し、チャート集計を再計算して整合性を保つ。
 *
 * @see {@link services/chart/core} チャートエンジン
 * @internal
 */
import type Bull from "bull";

import { queueLogger } from "../../logger.js";
import { driveChart, notesChart, usersChart } from "@/services/chart/index.js";

const logger = queueLogger.createSubLogger("resync-charts");

export async function resyncCharts(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Resync charts...");
	job.log("info - " + "Resync charts...");

	// TODO: ユーザーごとのチャートも更新する
	// TODO: インスタンスごとのチャートも更新する
	await Promise.all([
		driveChart.resync(),
		notesChart.resync(),
		usersChart.resync(),
	]);

	logger.succ("All charts successfully resynced.");
	job.log("succ - " + "All charts successfully resynced.");
	job.progress(100);
	done();
}
