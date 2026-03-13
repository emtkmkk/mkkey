/**
 * @packageDocumentation
 *
 * サーバーの健全性・キュー・APIレイテンシなどの統計を収集し報告するデーモン。
 *
 * @remarks
 * - **役割**: 定期的にイベントループ遅延・DB/Redis・API レイテンシ等を取得し、Xev で配信する。
 *
 * @internal
 */
import { monitorEventLoopDelay } from "perf_hooks";
import Xev from "xev";
import { db } from "@/db/postgre.js";
import { redisClient } from "@/db/redis.js";
import { fetchMeta } from "@/misc/fetch-meta.js";

type ServerStats = {
	cpu: number;
	mem: {
		total: number;
		active: number;
	};
};

type ApiLatencySample = {
	at: number;
	responseMs: number;
	/** エンドポイント名（例: notes/timeline） */
	endpoint: string;
};

type QueueStats = {
	deliver: {
		activeSincePrevTick: number;
		waiting: number;
		delayed: number;
		delayedByReason: {
			remote: number;
			local: number;
			unknown: number;
			pending: number;
		};
	};
	inbox: {
		activeSincePrevTick: number;
		waiting: number;
		delayed: number;
		delayedByReason: {
			remote: number;
			local: number;
			unknown: number;
			pending: number;
		};
	};
};



type SlowQuerySample = {
	pid: number;
	durationMs: number;
	state: string;
	waitEventType: string | null;
	query: string;
};
const ev = new Xev();

const interval = 5000;
const dbProbeInterval = 30000;
const redisProbeInterval = 30000;
const queueStatsIntervalSec = 10;
const apiLatencyWindowMs = 5 * 60 * 1000;
const minApiSampleCount = 5;
const incidentCooldownMs = 5 * 60 * 1000;
const longRunningQueryThresholdMs = 5000;
const longRunningQueryLimit = 5;
const slowCallThresholdMs = 1000;
const recentSlowCallsLimit = 10;
const slowestEndpointsTopN = 5;

const round = (num: number) => Math.round(num * 100) / 100;

const percentile = (sorted: number[], p: number): number => {
	if (sorted.length === 0) return 0;
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

const normalizeQuery = (query: string): string =>
	query.replace(/\s+/g, " ").trim().slice(0, 500);

type DiagnosisItem = {
	severity: "critical" | "warn" | "info";
	message: string;
	suggestion: string;
};

type StatsForDiagnosis = {
	cpuUsage: number;
	queuePressure: number;
	queueWaiting: number;
	eventLoopLagMs: number;
	dbLatencyMs: number;
	dbPoolStats: { total: number; active: number; idle: number; idleInTransaction: number };
	apiLatencyP95Ms: number;
	apiLatencyP50Ms: number;
	activeApiRequests: number;
	slowestEndpoints?: Array< { endpoint: string; avgMs: number; p95Ms: number; count: number } >;
	heapStats?: { heapUsagePercent: number };
	federationStats?: {
		notRespondingCount: number;
		deliverDelayed: { remote: number; local: number; unknown: number; pending: number };
		inboxDelayed: { remote: number; local: number; unknown: number; pending: number };
	};
	longRunningQueryCount: number;
	longRunningQueries: SlowQuerySample[];
};

function generateDiagnosis(s: StatsForDiagnosis): DiagnosisItem[] {
	const out: DiagnosisItem[] = [];

	if (s.apiLatencyP95Ms >= 800) {
		const top = s.slowestEndpoints?.[0];
		if (top) {
			out.push({
				severity: s.apiLatencyP95Ms >= 2000 ? "critical" : "warn",
				message: `APIの応答が遅くなっています。特に ${top.endpoint} の処理に時間がかかっています（P95: ${top.p95Ms}ms）。`,
				suggestion: "該当エンドポイントのクエリやN+1問題を確認してください。",
			});
		}
		if (s.apiLatencyP50Ms > 0 && s.apiLatencyP95Ms / s.apiLatencyP50Ms > 3) {
			out.push({
				severity: "info",
				message: `大半のリクエストは正常ですが、一部のリクエストが極端に遅くなっています（P50: ${s.apiLatencyP50Ms}ms / P95: ${s.apiLatencyP95Ms}ms）。`,
				suggestion: "遅いエンドポイントやパラメータの偏りを確認してください。",
			});
		}
		if (s.activeApiRequests >= 20) {
			out.push({
				severity: "info",
				message: `同時に ${s.activeApiRequests} 件のAPIリクエストが処理中です。リクエストの集中により応答が遅くなっている可能性があります。`,
				suggestion: "負荷の原因となっているクライアントやエンドポイントを確認してください。",
			});
		}
		if (s.dbPoolStats.total > 0 && s.dbPoolStats.active / s.dbPoolStats.total >= 0.8) {
			out.push({
				severity: "warn",
				message: `DBコネクションプールが逼迫しています（使用中: ${s.dbPoolStats.active}/${s.dbPoolStats.total}）。接続待ちが発生している可能性があります。`,
				suggestion: "config.db.extra でプールサイズの見直しや、長時間トランザクションの削減を検討してください。",
			});
		}
		if (s.heapStats && s.heapStats.heapUsagePercent >= 80) {
			out.push({
				severity: "warn",
				message: `Node.jsのヒープメモリ使用量が高くなっています（${s.heapStats.heapUsagePercent}%）。GCによる一時停止が発生している可能性があります。`,
				suggestion: "メモリリークや大きなオブジェクトの保持がないか確認してください。",
			});
		}
	}

	if (s.queuePressure >= 4) {
		const remote = s.federationStats?.deliverDelayed?.remote ?? 0;
		if (remote > 0) {
			out.push({
				severity: s.queuePressure >= 8 ? "critical" : "warn",
				message: `キューが詰まっています。リモートサーバーへの配送失敗が ${remote} 件あり、再試行待ちになっています。`,
				suggestion: "管理画面の「連合」から応答のないインスタンスを確認し、必要に応じて配送停止を検討してください。",
			});
		}
		const notResp = s.federationStats?.notRespondingCount ?? 0;
		if (notResp > 0) {
			out.push({
				severity: "info",
				message: `応答のないリモートサーバーが ${notResp} 件あります。これらへの配送の再試行がキューを圧迫している可能性があります。`,
				suggestion: "管理画面の「連合」から応答のないインスタンスを確認し、必要に応じて配送停止を検討してください。",
			});
		}
	}

	if (s.cpuUsage >= 75) {
		out.push({
			severity: s.cpuUsage >= 90 ? "critical" : "warn",
			message: `CPU使用率が ${s.cpuUsage}% に達しています。`,
			suggestion: "負荷の高い処理が実行されていないか確認してください。",
		});
	}

	if (s.eventLoopLagMs >= 120) {
		if (s.heapStats && s.heapStats.heapUsagePercent >= 70) {
			out.push({
				severity: s.eventLoopLagMs >= 250 ? "critical" : "warn",
				message: `イベントループの遅延が ${s.eventLoopLagMs}ms に達しています。ヒープ使用量が高いため、GCが原因の可能性があります。`,
				suggestion: "同期的な重い処理やメモリ使用量の削減を検討してください。",
			});
		} else if (s.cpuUsage >= 70) {
			out.push({
				severity: s.eventLoopLagMs >= 250 ? "critical" : "warn",
				message: "CPUの負荷が高いことがイベントループの遅延に影響しています。",
				suggestion: "同期的な重い処理がないか確認してください。",
			});
		} else {
			out.push({
				severity: s.eventLoopLagMs >= 250 ? "critical" : "warn",
				message: `イベントループの遅延が ${s.eventLoopLagMs}ms に達しています。`,
				suggestion: "同期的な重い処理がないか確認してください。",
			});
		}
	}

	if (s.dbLatencyMs >= 200) {
		if (s.longRunningQueryCount > 0) {
			out.push({
				severity: s.dbLatencyMs >= 500 ? "critical" : "warn",
				message: `DBの応答が遅くなっています（${s.dbLatencyMs}ms）。${s.longRunningQueryCount} 件の長時間実行クエリが検出されています。`,
				suggestion: "長時間実行クエリの内容を確認し、インデックスの追加やクエリの最適化を検討してください。",
			});
		} else {
			out.push({
				severity: s.dbLatencyMs >= 500 ? "critical" : "warn",
				message: `DBの応答が遅くなっています（${s.dbLatencyMs}ms）。`,
				suggestion: "ネットワークやディスクI/O、PostgreSQLの負荷を確認してください。",
			});
		}
	}

	if (s.longRunningQueryCount >= 1) {
		out.push({
			severity: s.longRunningQueryCount >= 3 ? "critical" : "warn",
			message: `${s.longRunningQueryCount} 件のクエリが ${longRunningQueryThresholdMs}ms 以上実行中です。`,
			suggestion: "クエリの内容を確認し、必要に応じて手動でキャンセル（pg_cancel_backend）することを検討してください。",
		});
	}

	return out;
}

/**
 * Report health score source stats regularly
 */
export default function () {
	const log = [] as any[];
	const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
	eventLoopDelay.enable();

	let latestServerStats: ServerStats | null = null;
	let latestQueueStats: QueueStats | null = null;
	let dbLatencyMs = 0;
	let redisLatencyMs = 0;
	let dbLatencyMeasuredAt: number | null = null;
	let redisLatencyMeasuredAt: number | null = null;
	let isDbProbeRunning = false;
	let isRedisProbeRunning = false;
	type RecentSlowCall = { endpoint: string; responseMs: number; at: number };
	let apiLatencySamples: ApiLatencySample[] = [];
	let recentSlowCalls: RecentSlowCall[] = [];
	let slowQueries: SlowQuerySample[] = [];
	let activeApiRequests = 0;
	let dbPoolStats: { total: number; active: number; idle: number; idleInTransaction: number } = {
		total: 0,
		active: 0,
		idle: 0,
		idleInTransaction: 0,
	};
	let federationNotRespondingCount = 0;
	const lastIncidentAtByMetric = new Map<string, number>();

	/** プロセス起動以降のヒープ等の最大値（障害ログ用） */
	let maxHeapUsedMb = 0;
	let maxHeapTotalMb = 0;
	let maxHeapUsagePercent = 0;
	let maxRssMb = 0;
	let maxExternalMb = 0;

	ev.on("apiRequestStart", () => {
		activeApiRequests += 1;
	});
	ev.on("apiRequestEnd", () => {
		activeApiRequests = Math.max(0, activeApiRequests - 1);
	});

	ev.on("serverStats", (stats: ServerStats) => {
		latestServerStats = stats;
	});

	ev.on("queueStats", (stats: QueueStats) => {
		latestQueueStats = stats;
	});

	ev.on("apiLatency", (sample: ApiLatencySample) => {
		apiLatencySamples.push(sample);
		const cutoff = Date.now() - apiLatencyWindowMs;
		apiLatencySamples = apiLatencySamples.filter((x) => x.at >= cutoff);
		if (sample.responseMs >= slowCallThresholdMs) {
			recentSlowCalls.unshift({
				endpoint: sample.endpoint ?? "unknown",
				responseMs: sample.responseMs,
				at: sample.at,
			});
			if (recentSlowCalls.length > recentSlowCallsLimit) {
				recentSlowCalls.pop();
			}
		}
	});

	ev.on("requestHealthStatsLog", (x) => {
		ev.emit(`healthStatsLog:${x.id}`, log.slice(0, x.length || 50));
	});

	const maybeProbeDb = async () => {
		const now = Date.now();
		if (isDbProbeRunning) return;
		if (dbLatencyMeasuredAt && now - dbLatencyMeasuredAt < dbProbeInterval) return;

		isDbProbeRunning = true;
		const startedAt = Date.now();
		try {
			await db.query("SELECT 1");
			dbLatencyMs = Date.now() - startedAt;
		} catch {
			dbLatencyMs = dbProbeInterval;
		} finally {
			dbLatencyMeasuredAt = Date.now();
			isDbProbeRunning = false;
		}
	};

	const maybeProbeRedis = async () => {
		const now = Date.now();
		if (isRedisProbeRunning) return;
		if (redisLatencyMeasuredAt && now - redisLatencyMeasuredAt < redisProbeInterval)
			return;

		isRedisProbeRunning = true;
		const startedAt = Date.now();
		try {
			await redisClient.ping();
			redisLatencyMs = Date.now() - startedAt;
		} catch {
			redisLatencyMs = redisProbeInterval;
		} finally {
			redisLatencyMeasuredAt = Date.now();
			isRedisProbeRunning = false;
		}
	};

	const maybeCollectLongRunningQueries = async () => {
		const rows = await db
			.query(
				`SELECT pid,
						(EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) * 1000)::double precision AS "durationMs",
						state,
						"wait_event_type" AS "waitEventType",
						query
				 FROM pg_stat_activity
				 WHERE state = 'active'
					AND query_start IS NOT NULL
					AND clock_timestamp() - query_start >= ($1::int * INTERVAL '1 millisecond')
					AND query NOT ILIKE '%pg_stat_activity%'
				 ORDER BY "durationMs" DESC
				 LIMIT $2`,
				[longRunningQueryThresholdMs, longRunningQueryLimit],
			)
			.catch(() => []);

		slowQueries = rows.map((row) => ({
			pid: row.pid,
			durationMs: round(Number(row.durationMs)),
			state: row.state,
			waitEventType: row.waitEventType,
			query: normalizeQuery(row.query),
		}));
	};

	const maybeCollectDbPoolStats = async () => {
		const rows = await db
			.query(
				`SELECT
					count(*)::int AS total,
					count(*) FILTER (WHERE state = 'active')::int AS active,
					count(*) FILTER (WHERE state = 'idle')::int AS idle,
					count(*) FILTER (WHERE state = 'idle in transaction')::int AS "idleInTransaction"
				 FROM pg_stat_activity
				 WHERE datname = current_database()
					AND pid <> pg_backend_pid()`,
			)
			.catch(() => [{ total: 0, active: 0, idle: 0, idleInTransaction: 0 }]);
		const row = rows[0];
		if (row) {
			dbPoolStats = {
				total: Number(row.total),
				active: Number(row.active),
				idle: Number(row.idle),
				idleInTransaction: Number(row.idleInTransaction),
			};
		}
	};

	const maybeCollectFederationStats = async () => {
		const rows = await db
			.query(
				`SELECT count(*)::int AS "notRespondingCount"
				 FROM "instance"
				 WHERE "isNotResponding" = true`,
			)
			.catch(() => [{ notRespondingCount: 0 }]);
		federationNotRespondingCount = Number(rows[0]?.notRespondingCount ?? 0);
	};

	const shouldRecordIncident = (metric: string, value: number, threshold: number) => {
		if (value < threshold) return false;
		const now = Date.now();
		const lastRecordedAt = lastIncidentAtByMetric.get(metric) ?? 0;
		if (now - lastRecordedAt < incidentCooldownMs) return false;
		lastIncidentAtByMetric.set(metric, now);
		return true;
	};

	const recordIncident = async (severity: "warn" | "critical", metric: string, value: number, stats: Record<string, unknown>) => {
		await db.query(
			`INSERT INTO "performance_incident" ("severity", "metric", "value", "stats") VALUES ($1, $2, $3, $4::jsonb)`,
			[severity, metric, value, JSON.stringify(stats)],
		).catch(() => null);
	};

	async function tick() {
		await Promise.all([
			maybeProbeDb(),
			maybeProbeRedis(),
			maybeCollectLongRunningQueries(),
			maybeCollectDbPoolStats(),
			maybeCollectFederationStats(),
		]);

		const cpuUsage = latestServerStats ? latestServerStats.cpu : 0;
		const memoryUsage =
			latestServerStats && latestServerStats.mem.total > 0
				? latestServerStats.mem.active / latestServerStats.mem.total
				: 0;

		const localOrUnknownDelayed = latestQueueStats
			? latestQueueStats.inbox.delayedByReason.local +
				latestQueueStats.inbox.delayedByReason.unknown +
				latestQueueStats.inbox.delayedByReason.pending +
				latestQueueStats.deliver.delayedByReason.local +
				latestQueueStats.deliver.delayedByReason.unknown +
				latestQueueStats.deliver.delayedByReason.pending
			: 0;
		const queueWaiting = latestQueueStats
			? latestQueueStats.inbox.waiting +
				latestQueueStats.deliver.waiting +
				localOrUnknownDelayed
			: 0;
		const queueThroughputPerTick = latestQueueStats
			? latestQueueStats.inbox.activeSincePrevTick +
				latestQueueStats.deliver.activeSincePrevTick
			: 0;
		const queueThroughputPerSec = queueThroughputPerTick / queueStatsIntervalSec;
		const queuePressure = queueWaiting / Math.max(queueThroughputPerTick, 1);

		const apiLatencyCount = apiLatencySamples.length;
		const apiLatencyAverageMs =
			apiLatencyCount > 0
				? apiLatencySamples.reduce((sum, sample) => sum + sample.responseMs, 0) /
					apiLatencyCount
				: 0;
		const sortedApiLatencies = [...apiLatencySamples]
			.map((sample) => sample.responseMs)
			.sort((a, b) => a - b);
		const apiLatencyP95Ms =
			apiLatencyCount >= minApiSampleCount
				? percentile(sortedApiLatencies, 95)
				: 0;
		const apiLatencyP50Ms =
			apiLatencyCount >= minApiSampleCount
				? percentile(sortedApiLatencies, 50)
				: 0;

		const byEndpoint = new Map<
			string,
			{ responseMs: number[] }
		>();
		for (const sample of apiLatencySamples) {
			const ep = sample.endpoint ?? "unknown";
			if (!byEndpoint.has(ep)) byEndpoint.set(ep, { responseMs: [] });
			byEndpoint.get(ep)!.responseMs.push(sample.responseMs);
		}
		const slowestEndpoints = [...byEndpoint.entries()]
			.map(([endpoint, { responseMs }]) => {
				const sorted = [...responseMs].sort((a, b) => a - b);
				return {
					endpoint,
					avgMs: round(
						responseMs.reduce((s, v) => s + v, 0) / responseMs.length,
					),
					p95Ms: round(percentile(sorted, 95)),
					count: responseMs.length,
				};
			})
			.sort((a, b) => b.p95Ms - a.p95Ms)
			.slice(0, slowestEndpointsTopN);

		const mem = process.memoryUsage();
		const heapUsedMb = mem.heapUsed / 1e6;
		const heapTotalMb = mem.heapTotal / 1e6;
		const rssMb = mem.rss / 1e6;
		const externalMb = (mem.external ?? 0) / 1e6;
		const arrayBuffersMb = (mem.arrayBuffers ?? 0) / 1e6;
		const heapUsagePercent = heapTotalMb > 0 ? (heapUsedMb / heapTotalMb) * 100 : 0;

		maxHeapUsedMb = Math.max(maxHeapUsedMb, heapUsedMb);
		maxHeapTotalMb = Math.max(maxHeapTotalMb, heapTotalMb);
		maxHeapUsagePercent = Math.max(maxHeapUsagePercent, heapUsagePercent);
		maxRssMb = Math.max(maxRssMb, rssMb);
		maxExternalMb = Math.max(maxExternalMb, externalMb);

		const heapStats = {
			heapUsedMb: round(heapUsedMb),
			heapTotalMb: round(heapTotalMb),
			rssMb: round(rssMb),
			externalMb: round(externalMb),
			arrayBuffersMb: round(arrayBuffersMb),
			heapUsagePercent: round(heapUsagePercent),
			heapUsedMbMax: round(maxHeapUsedMb),
			heapTotalMbMax: round(maxHeapTotalMb),
			rssMbMax: round(maxRssMb),
			externalMbMax: round(maxExternalMb),
			heapUsagePercentMax: round(maxHeapUsagePercent),
		};

		const federationStats = {
			notRespondingCount: federationNotRespondingCount,
			deliverDelayed: latestQueueStats?.deliver.delayedByReason ?? {
				remote: 0,
				local: 0,
				unknown: 0,
				pending: 0,
			},
			inboxDelayed: latestQueueStats?.inbox.delayedByReason ?? {
				remote: 0,
				local: 0,
				unknown: 0,
				pending: 0,
			},
		};

		const stats = {
			cpuUsage: round(cpuUsage * 100),
			memoryUsage: round(memoryUsage * 100),
			queuePressure: round(queuePressure),
			queueWaiting,
			queueThroughputPerSec: round(queueThroughputPerSec),
			eventLoopLagMs: round(eventLoopDelay.mean / 1e6),
			dbLatencyMs,
			redisLatencyMs,
			activeApiRequests,
			apiLatencyAvgMs: round(apiLatencyAverageMs),
			apiLatencyP50Ms,
			apiLatencyP95Ms: round(apiLatencyP95Ms),
			apiLatencySampleCount: apiLatencyCount,
			slowestEndpoints,
			recentSlowCalls: [...recentSlowCalls],
			heapStats,
			dbPoolStats,
			federationStats,
			longRunningQueryCount: slowQueries.length,
			longRunningQueries: slowQueries,
		};

		(stats as Record<string, unknown>).diagnosis = generateDiagnosis(
			stats as unknown as StatsForDiagnosis,
		);

		let enablePerformanceIncidentCollection = true;
		try {
			const instanceMeta = await fetchMeta();
			enablePerformanceIncidentCollection = instanceMeta.enablePerformanceIncidentCollection;
		} catch {
			// ヘルススコア配信は継続し、DB記録判定のみデフォルト値を使う
		}

		if (enablePerformanceIncidentCollection) {
			if (shouldRecordIncident("cpuUsage", stats.cpuUsage, 90)) {
				await recordIncident("critical", "cpuUsage", stats.cpuUsage, stats);
			} else if (shouldRecordIncident("cpuUsageWarn", stats.cpuUsage, 75)) {
				await recordIncident("warn", "cpuUsage", stats.cpuUsage, stats);
			}

			if (shouldRecordIncident("queuePressure", stats.queuePressure, 8)) {
				await recordIncident("critical", "queuePressure", stats.queuePressure, stats);
			} else if (shouldRecordIncident("queuePressureWarn", stats.queuePressure, 4)) {
				await recordIncident("warn", "queuePressure", stats.queuePressure, stats);
			}

			if (shouldRecordIncident("eventLoopLagMs", stats.eventLoopLagMs, 250)) {
				await recordIncident("critical", "eventLoopLagMs", stats.eventLoopLagMs, stats);
			} else if (shouldRecordIncident("eventLoopLagMsWarn", stats.eventLoopLagMs, 120)) {
				await recordIncident("warn", "eventLoopLagMs", stats.eventLoopLagMs, stats);
			}

			if (shouldRecordIncident("dbLatencyMs", stats.dbLatencyMs, 500)) {
				await recordIncident("critical", "dbLatencyMs", stats.dbLatencyMs, stats);
			} else if (shouldRecordIncident("dbLatencyMsWarn", stats.dbLatencyMs, 200)) {
				await recordIncident("warn", "dbLatencyMs", stats.dbLatencyMs, stats);
			}

			if (shouldRecordIncident("dbLongRunningQueryCount", stats.longRunningQueryCount, 3)) {
				await recordIncident(
					"critical",
					"dbLongRunningQueryCount",
					stats.longRunningQueryCount,
					stats,
				);
			} else if (shouldRecordIncident("dbLongRunningQueryCountWarn", stats.longRunningQueryCount, 1)) {
				await recordIncident(
					"warn",
					"dbLongRunningQueryCount",
					stats.longRunningQueryCount,
					stats,
				);
			}

			if (shouldRecordIncident("apiLatencyP95Ms", stats.apiLatencyP95Ms, 2000)) {
				await recordIncident("critical", "apiLatencyP95Ms", stats.apiLatencyP95Ms, stats);
			} else if (shouldRecordIncident("apiLatencyP95MsWarn", stats.apiLatencyP95Ms, 800)) {
				await recordIncident("warn", "apiLatencyP95Ms", stats.apiLatencyP95Ms, stats);
			}
		}

		ev.emit("healthStats", stats);
		log.unshift(stats);
		if (log.length > 200) log.pop();
	}

	tick();

	setInterval(tick, interval);
}
