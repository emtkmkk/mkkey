import { monitorEventLoopDelay } from "perf_hooks";
import Xev from "xev";
import { db } from "@/db/postgre.js";
import { redisClient } from "@/db/redis.js";

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

const round = (num: number) => Math.round(num * 100) / 100;

const percentile = (sorted: number[], p: number): number => {
	if (sorted.length === 0) return 0;
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

const normalizeQuery = (query: string): string =>
	query.replace(/\s+/g, " ").trim().slice(0, 500);

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
	let apiLatencySamples: ApiLatencySample[] = [];
	let slowQueries: SlowQuerySample[] = [];
	const lastIncidentAtByMetric = new Map<string, number>();

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
		await Promise.all([maybeProbeDb(), maybeProbeRedis(), maybeCollectLongRunningQueries()]);

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

		const stats = {
			cpuUsage: round(cpuUsage * 100),
			memoryUsage: round(memoryUsage * 100),
			queuePressure: round(queuePressure),
			queueWaiting,
			queueThroughputPerSec: round(queueThroughputPerSec),
			eventLoopLagMs: round(eventLoopDelay.mean / 1e6),
			dbLatencyMs,
			redisLatencyMs,
			apiLatencyAvgMs: round(apiLatencyAverageMs),
			apiLatencyP95Ms: round(apiLatencyP95Ms),
			apiLatencySampleCount: apiLatencyCount,
			longRunningQueryCount: slowQueries.length,
			longRunningQueries: slowQueries,
		};

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

		ev.emit("healthStats", stats);
		log.unshift(stats);
		if (log.length > 200) log.pop();
	}

	tick();

	setInterval(tick, interval);
}
