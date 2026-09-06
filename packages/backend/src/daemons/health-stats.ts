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
import si from "systeminformation";
import Xev from "xev";
import { db } from "@/db/postgre.js";
import { redisClient } from "@/db/redis.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { resolveRssBytes } from "@/misc/process-rss.js";
import { calculateHealthScore } from "@/services/health-score.js";

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
	/** HTTP 5xx 相当の内部エラーで完了したか。 */
	serverError?: boolean;
};

type QueueStats = {
	deliver: {
		activeSincePrevTick: number;
		waiting: number;
		oldestWaitingMs: number;
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
		oldestWaitingMs: number;
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

/**
 * ワーカーから届くメモリ報告。
 *
 * @remarks
 * このデーモンは master で動くため `process.memoryUsage()` では master しか測れない。
 * 実際に膨らむのは web ワーカーなので、各ワーカーが Xev で送ってくる値を集計する。
 * @see {@link daemons/worker-memory-watch} 送り手
 */
type WorkerMemory = {
	index: string;
	mode: string;
	pid: number;
	rssMb: number;
	heapUsedMb: number;
	heapTotalMb: number;
	externalMb: number;
	arrayBuffersMb: number;
	peakRssMb: number;
	eventLoopLagMs: number | null;
	at: number;
};

/** master が通知する予期しないワーカー終了。 */
type WorkerRestart = {
	mode: "web" | "queue";
	index: string;
	at: number;
};

/** 起動構成から渡される期待ワーカー数。 */
type HealthStatsOptions = {
	expectedWebWorkers: number;
	expectedQueueWorkers: number;
};

const ev = new Xev();

const interval = 5000;
const dbProbeInterval = 30000;
const redisProbeInterval = 30000;
const diskProbeInterval = 60000;
const queueStatsIntervalSec = 10;
const apiLatencyWindowMs = 5 * 60 * 1000;
const workerRestartWindowMs = 10 * 60 * 1000;
const minApiSampleCount = 5;
const incidentCooldownMs = 5 * 60 * 1000;
const longRunningQueryThresholdMs = 5000;
const longRunningQueryLimit = 5;
const slowCallThresholdMs = 1000;
const recentSlowCallsLimit = 10;
const slowestEndpointsTopN = 5;
/** ワーカーのメモリ報告をどれだけ古くなるまで有効とみなすか（死んだワーカーを落とす） */
const workerMemoryStaleMs = 60_000;
/** これより新しい報告だけを応答中ワーカーとして数える。 */
const workerHeartbeatFreshMs = 15_000;
/** ワーカー RSS のインシデント閾値（MB）。通常運用は 250-450MB 程度。 */
const workerRssWarnMb = 800;
const workerRssCriticalMb = 1200;

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
	workerMemory?: { maxRssMb: number; maxRssWorker: string | null };
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
		if (s.workerMemory && s.workerMemory.maxRssMb >= workerRssWarnMb) {
			out.push({
				severity:
					s.workerMemory.maxRssMb >= workerRssCriticalMb ? "critical" : "warn",
				message: `ワーカー ${s.workerMemory.maxRssWorker ?? "?"} のメモリが ${s.workerMemory.maxRssMb}MB まで増加しています。放置するとOOMでプロセスが停止する可能性があります。`,
				suggestion:
					"該当ワーカーのヒープスナップショットを取得し、保持されているオブジェクトを確認してください。",
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
 * ヘルス統計の収集と固定スコアの配信を開始する。
 *
 * @param options - 起動構成上の期待ワーカー数
 * @returns 戻り値なし
 * @internal
 */
export default function (options: HealthStatsOptions): void {
	const log: unknown[] = [];
	/** 起動直後のワーカーハートビート未着を障害として扱わないための基準時刻。 */
	const startedAt = Date.now();

	let latestServerStats: ServerStats | null = null;
	let latestQueueStats: QueueStats | null = null;
	let dbLatencyMs: number | null = null;
	let redisLatencyMs: number | null = null;
	let dbAvailable: boolean | null = null;
	let redisAvailable: boolean | null = null;
	let diskAvailablePercent: number | null = null;
	let diskAvailableBytes: number | null = null;
	let dbLatencyMeasuredAt: number | null = null;
	let redisLatencyMeasuredAt: number | null = null;
	let diskMeasuredAt: number | null = null;
	let isDbProbeRunning = false;
	let isRedisProbeRunning = false;
	let isDiskProbeRunning = false;
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
	let workerRestarts: WorkerRestart[] = [];
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

	/** ワーカースロット（mode:index） -> 直近のハートビート兼メモリ報告 */
	const workerMemoryBySlot = new Map<string, WorkerMemory>();

	ev.on("workerMemory", (m: WorkerMemory) => {
		if (m?.pid == null) return;
		workerMemoryBySlot.set(`${m.mode}:${m.index}`, m);
	});

	ev.on("workerRestart", (restart: WorkerRestart) => {
		if (!(restart?.mode && Number.isFinite(restart.at))) return;
		workerRestarts.push(restart);
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
			dbAvailable = true;
		} catch {
			dbLatencyMs = dbProbeInterval;
			dbAvailable = false;
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
			redisAvailable = true;
		} catch {
			redisLatencyMs = redisProbeInterval;
			redisAvailable = false;
		} finally {
			redisLatencyMeasuredAt = Date.now();
			isRedisProbeRunning = false;
		}
	};

	/** 低頻度でアプリサーバーのルートファイルシステム空き容量を更新する。 */
	const maybeProbeDisk = async (): Promise<void> => {
		const now = Date.now();
		if (isDiskProbeRunning) return;
		if (diskMeasuredAt && now - diskMeasuredAt < diskProbeInterval) return;

		isDiskProbeRunning = true;
		try {
			const fileSystems = await si.fsSize();
			const root =
				fileSystems.find((fileSystem) => fileSystem.mount === "/") ??
				[...fileSystems].sort((a, b) => b.size - a.size)[0];
			if (root && root.size > 0) {
				diskAvailableBytes = root.available;
				diskAvailablePercent = (root.available / root.size) * 100;
			} else {
				diskAvailableBytes = null;
				diskAvailablePercent = null;
			}
		} catch {
			diskAvailableBytes = null;
			diskAvailablePercent = null;
		} finally {
			diskMeasuredAt = Date.now();
			isDiskProbeRunning = false;
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
			maybeProbeDisk(),
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

		const apiCutoff = Date.now() - apiLatencyWindowMs;
		apiLatencySamples = apiLatencySamples.filter((sample) => sample.at >= apiCutoff);
		recentSlowCalls = recentSlowCalls.filter((sample) => sample.at >= apiCutoff);
		const apiLatencyCount = apiLatencySamples.length;
		const apiServerErrorCount = apiLatencySamples.filter(
			(sample) => sample.serverError === true,
		).length;
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
		// mem.rss は process.title の括弧のせいで壊れた値になる。@see misc/process-rss
		const rssMb = (resolveRssBytes(mem.rss) ?? 0) / 1e6;
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

		// ワーカーのメモリと応答性を集計する。古いスロット報告は欠損判定後に破棄する。
		const nowMs = Date.now();
		for (const [slot, worker] of workerMemoryBySlot) {
			if (nowMs - worker.at > workerMemoryStaleMs) {
				workerMemoryBySlot.delete(slot);
			}
		}
		const liveWorkers = [...workerMemoryBySlot.values()]
			.filter((worker) => nowMs - worker.at <= workerHeartbeatFreshMs)
			.sort(
			(a, b) => b.rssMb - a.rssMb,
			);
		const liveWebWorkers = liveWorkers.filter((worker) => worker.mode === "web");
		const liveQueueWorkers = liveWorkers.filter(
			(worker) => worker.mode === "queue",
		);
		const workerEventLoopLagMs = liveWebWorkers.reduce<number | null>(
			(max, worker) => {
				if (
					worker.eventLoopLagMs == null ||
					!Number.isFinite(worker.eventLoopLagMs)
				) {
					return max;
				}
				return max == null ? worker.eventLoopLagMs : Math.max(max, worker.eventLoopLagMs);
			},
			null,
		);
		workerRestarts = workerRestarts.filter(
			(restart) => restart.at >= nowMs - workerRestartWindowMs,
		);
		const worstWorker = liveWorkers[0];
		const workerMemory = {
			count: liveWorkers.length,
			maxRssMb: worstWorker?.rssMb ?? 0,
			maxRssWorker: worstWorker
				? `${worstWorker.mode}<${worstWorker.index}>`
				: null,
			totalRssMb: liveWorkers.reduce((sum, w) => sum + w.rssMb, 0),
			workers: liveWorkers.map((w) => ({
				worker: `${w.mode}<${w.index}>`,
				pid: w.pid,
				rssMb: w.rssMb,
				heapUsedMb: w.heapUsedMb,
				externalMb: w.externalMb,
				arrayBuffersMb: w.arrayBuffersMb,
				peakRssMb: w.peakRssMb,
				eventLoopLagMs: w.eventLoopLagMs,
			})),
		};
		const workerHealth = {
			expectedWebWorkers: options.expectedWebWorkers,
			respondingWebWorkers: liveWebWorkers.length,
			expectedQueueWorkers: options.expectedQueueWorkers,
			respondingQueueWorkers: liveQueueWorkers.length,
			restartCount10m: workerRestarts.length,
			maxEventLoopLagMs: workerEventLoopLagMs,
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
		// 全ワーカーが最初の報告を送るまでの短い猶予中は、生存率とキュー実行系を評価しない。
		const workerExpectationsReady =
			nowMs - startedAt >= workerHeartbeatFreshMs;
		const calculatedHealthScore = calculateHealthScore({
			apiLatencyP95Ms:
				apiLatencyCount >= minApiSampleCount ? round(apiLatencyP95Ms) : null,
			apiLatencySampleCount: apiLatencyCount,
			apiServerErrorCount,
			expectedWebWorkers: workerExpectationsReady
				? options.expectedWebWorkers
				: 0,
			respondingWebWorkers: liveWebWorkers.length,
			expectedQueueWorkers: workerExpectationsReady
				? options.expectedQueueWorkers
				: 0,
			respondingQueueWorkers: liveQueueWorkers.length,
			workerRestartCount10m: workerRestarts.length,
			workerEventLoopLagMs,
			inboxOldestWaitingMs: latestQueueStats?.inbox.oldestWaitingMs ?? null,
			deliverOldestWaitingMs: latestQueueStats?.deliver.oldestWaitingMs ?? null,
			dbLatencyMs,
			dbAvailable,
			redisLatencyMs,
			redisAvailable,
			workerMaxRssMb: worstWorker?.rssMb ?? null,
			diskAvailablePercent,
			diskAvailableBytes,
		});
		const healthScore = workerExpectationsReady
			? calculatedHealthScore
			: {
					...calculatedHealthScore,
					score: null,
					status: "unknown" as const,
				};

		const stats = {
			cpuUsage: round(cpuUsage * 100),
			memoryUsage: round(memoryUsage * 100),
			queuePressure: round(queuePressure),
			queueWaiting,
			queueThroughputPerSec: round(queueThroughputPerSec),
			eventLoopLagMs: round(workerEventLoopLagMs ?? 0),
			dbLatencyMs: dbLatencyMs ?? 0,
			redisLatencyMs: redisLatencyMs ?? 0,
			dbAvailable,
			redisAvailable,
			diskAvailablePercent:
				diskAvailablePercent == null ? null : round(diskAvailablePercent),
			diskAvailableBytes,
			activeApiRequests,
			apiLatencyAvgMs: round(apiLatencyAverageMs),
			apiLatencyP50Ms,
			apiLatencyP95Ms: round(apiLatencyP95Ms),
			apiLatencySampleCount: apiLatencyCount,
			apiServerErrorCount,
			apiServerErrorRate:
				apiLatencyCount > 0
					? round((apiServerErrorCount / apiLatencyCount) * 100)
					: null,
			inboxOldestWaitingMs: latestQueueStats?.inbox.oldestWaitingMs ?? null,
			deliverOldestWaitingMs: latestQueueStats?.deliver.oldestWaitingMs ?? null,
			slowestEndpoints,
			recentSlowCalls: [...recentSlowCalls],
			heapStats,
			workerMemory,
			workerHealth,
			dbPoolStats,
			federationStats,
			longRunningQueryCount: slowQueries.length,
			longRunningQueries: slowQueries,
			healthScore,
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

			// ワーカーの膨張は OOM に直結するため、必ず記録に残す
			if (
				shouldRecordIncident(
					"workerRssMb",
					workerMemory.maxRssMb,
					workerRssCriticalMb,
				)
			) {
				await recordIncident(
					"critical",
					"workerRssMb",
					workerMemory.maxRssMb,
					stats,
				);
			} else if (
				shouldRecordIncident(
					"workerRssMbWarn",
					workerMemory.maxRssMb,
					workerRssWarnMb,
				)
			) {
				await recordIncident(
					"warn",
					"workerRssMb",
					workerMemory.maxRssMb,
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
