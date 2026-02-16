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

type QueueStats = {
	deliver: {
		activeSincePrevTick: number;
		waiting: number;
		delayed: number;
	};
	inbox: {
		activeSincePrevTick: number;
		waiting: number;
		delayed: number;
	};
};

const ev = new Xev();

const interval = 5000;
const dbProbeInterval = 30000;
const redisProbeInterval = 30000;
const queueStatsIntervalSec = 10;

const round = (num: number) => Math.round(num * 100) / 100;

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

	ev.on("serverStats", (stats: ServerStats) => {
		latestServerStats = stats;
	});

	ev.on("queueStats", (stats: QueueStats) => {
		latestQueueStats = stats;
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

	async function tick() {
		await Promise.all([maybeProbeDb(), maybeProbeRedis()]);

		const cpuUsage = latestServerStats ? latestServerStats.cpu : 0;
		const memoryUsage =
			latestServerStats && latestServerStats.mem.total > 0
				? latestServerStats.mem.active / latestServerStats.mem.total
				: 0;

		const queueWaiting = latestQueueStats
			? latestQueueStats.inbox.waiting +
				latestQueueStats.deliver.waiting +
				latestQueueStats.inbox.delayed +
				latestQueueStats.deliver.delayed
			: 0;
		const queueThroughputPerTick = latestQueueStats
			? latestQueueStats.inbox.activeSincePrevTick +
				latestQueueStats.deliver.activeSincePrevTick
			: 0;
		const queueThroughputPerSec = queueThroughputPerTick / queueStatsIntervalSec;
		const queuePressure = queueWaiting / Math.max(queueThroughputPerTick, 1);

		const stats = {
			cpuUsage: round(cpuUsage * 100),
			memoryUsage: round(memoryUsage * 100),
			queuePressure: round(queuePressure),
			queueWaiting,
			queueThroughputPerSec: round(queueThroughputPerSec),
			eventLoopLagMs: round(eventLoopDelay.mean / 1e6),
			dbLatencyMs,
			redisLatencyMs,
		};

		ev.emit("healthStats", stats);
		log.unshift(stats);
		if (log.length > 200) log.pop();
	}

	tick();

	setInterval(tick, interval);
}
