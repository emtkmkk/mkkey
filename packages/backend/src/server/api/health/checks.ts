/**
 * @packageDocumentation
 *
 * `/api/health/*` のチェック処理とキャッシュを提供する。
 *
 * @remarks
 * - `live` はキャッシュせず即時判定する。
 * - `db` / `redis` / `backend` は 1 分キャッシュする。
 * - `storage` は 10 分キャッシュする。
 * - DB はインスタンス情報読込の可否を 60 秒タイムアウト付きで判定する。
 * - ストレージは object storage 利用時に PUT/GET/DELETE、ローカル時に write/read/delete を実施する。
 *
 * @internal
 */
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { redisClient } from "@/db/redis.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { getS3 } from "@/services/drive/s3.js";

// #region 定数
const ONE_MINUTE_MS = 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const DB_TIMEOUT_MS = 60 * 1000;
const COMMON_TIMEOUT_MS = 60 * 1000;
const STORAGE_PAYLOAD = "mkkey-health-storage-check";
// #endregion

// #region 型定義
export type HealthCheckName = "db" | "redis" | "storage" | "backend";

/**
 * ヘルスチェック結果。
 *
 * @remarks
 * - `status` は HTTP の返却コードと同じ意味で扱う（200/503）。
 * - `cached` はこのレスポンスがキャッシュ由来かを示す。
 * - `components` は `backend` 集約時のみ利用する。
 * - `phases` は `storage` のフェーズ別時間を示す。
 *
 * @public
 */
export type HealthCheckResult = {
	ok: boolean;
	status: 200 | 503;
	cached: boolean;
	checkedAt: string;
	latencyMs: number;
	reason?: string;
	components?: Record<string, HealthCheckResult>;
	phases?: {
		writeMs: number;
		readMs: number;
		deleteMs: number;
	};
};
// #endregion

type CacheEntry = {
	expiresAt: number;
	value: HealthCheckResult;
};

const cache = new Map<HealthCheckName, CacheEntry>();

// #region 共通ユーティリティ
function nowMs(): number {
	return Date.now();
}

function makeOk(checkedAt: string, latencyMs: number): HealthCheckResult {
	return {
		ok: true,
		status: 200,
		cached: false,
		checkedAt,
		latencyMs,
	};
}

function makeNg(
	checkedAt: string,
	latencyMs: number,
	reason: string,
): HealthCheckResult {
	return {
		ok: false,
		status: 503,
		cached: false,
		checkedAt,
		latencyMs,
		reason,
	};
}

function markCached(result: HealthCheckResult): HealthCheckResult {
	return {
		...result,
		cached: true,
		components: result.components
			? Object.fromEntries(
					Object.entries(result.components).map(([k, v]) => [k, markCached(v)]),
			  )
			: undefined,
	};
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<T> {
	return await Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`${label} timed out`));
			}, timeoutMs);
		}),
	]);
}

async function runWithCache(
	name: HealthCheckName,
	runner: () => Promise<HealthCheckResult>,
	ttlMs = ONE_MINUTE_MS,
): Promise<HealthCheckResult> {
	const entry = cache.get(name);
	const now = nowMs();
	if (entry && entry.expiresAt > now) {
		return markCached(entry.value);
	}

	const result = await runner();
	cache.set(name, {
		expiresAt: now + ttlMs,
		value: result,
	});
	return result;
}
// #endregion

// #region 個別チェック本体
async function runDbCheckCore(): Promise<HealthCheckResult> {
	const started = nowMs();
	const checkedAt = new Date().toISOString();
	try {
		// NOTE: インスタンス情報読み込みの実運用経路に寄せるため fetchMeta を利用する。
		await withTimeout(fetchMeta(true), DB_TIMEOUT_MS, "db check");
		return makeOk(checkedAt, nowMs() - started);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "failed to read instance metadata";
		return makeNg(checkedAt, nowMs() - started, message);
	}
}

async function runRedisCheckCore(): Promise<HealthCheckResult> {
	const started = nowMs();
	const checkedAt = new Date().toISOString();
	try {
		await withTimeout(redisClient.ping(), COMMON_TIMEOUT_MS, "redis ping");
		return makeOk(checkedAt, nowMs() - started);
	} catch (error) {
		const message = error instanceof Error ? error.message : "redis ping failed";
		return makeNg(checkedAt, nowMs() - started, message);
	}
}

async function runStorageCheckCore(): Promise<HealthCheckResult> {
	const started = nowMs();
	const checkedAt = new Date().toISOString();
	let writeMs = 0;
	let readMs = 0;
	let deleteMs = 0;
	try {
		const meta = await withTimeout(fetchMeta(true), COMMON_TIMEOUT_MS, "meta load");
		if (meta.useObjectStorage) {
			const s3 = getS3(meta);
			const key = `healthcheck/${Date.now()}-${randomUUID()}.txt`;
			const bucket = meta.objectStorageBucket;
			if (!bucket) {
				throw new Error("objectStorageBucket is not configured");
			}
			const writeStarted = nowMs();
			await withTimeout(
				s3
					.putObject({
						Bucket: bucket,
						Key: key,
						Body: STORAGE_PAYLOAD,
						ContentType: "text/plain; charset=utf-8",
					})
					.promise(),
				COMMON_TIMEOUT_MS,
				"storage write",
			);
			writeMs = nowMs() - writeStarted;

			try {
				const readStarted = nowMs();
				const object = await withTimeout(
					s3
						.getObject({
							Bucket: bucket,
							Key: key,
						})
						.promise(),
					COMMON_TIMEOUT_MS,
					"storage read",
				);
				readMs = nowMs() - readStarted;
				const body = object.Body?.toString("utf-8") ?? "";
				if (!body.includes(STORAGE_PAYLOAD)) {
					throw new Error("storage read verification failed");
				}
			} finally {
				const deleteStarted = nowMs();
				await withTimeout(
					s3
						.deleteObject({
							Bucket: bucket,
							Key: key,
						})
						.promise(),
					COMMON_TIMEOUT_MS,
					"storage delete",
				).catch(() => null);
				deleteMs = nowMs() - deleteStarted;
			}
		} else {
			const filePath = join(tmpdir(), `mkkey-health-${randomUUID()}.txt`);
			const writeStarted = nowMs();
			await withTimeout(
				fs.writeFile(filePath, STORAGE_PAYLOAD, "utf-8"),
				COMMON_TIMEOUT_MS,
				"storage write",
			);
			writeMs = nowMs() - writeStarted;

			try {
				const readStarted = nowMs();
				const readData = await withTimeout(
					fs.readFile(filePath, "utf-8"),
					COMMON_TIMEOUT_MS,
					"storage read",
				);
				readMs = nowMs() - readStarted;
				if (readData !== STORAGE_PAYLOAD) {
					throw new Error("local storage read verification failed");
				}
			} finally {
				const deleteStarted = nowMs();
				await withTimeout(fs.unlink(filePath), COMMON_TIMEOUT_MS, "storage delete").catch(
					() => null,
				);
				deleteMs = nowMs() - deleteStarted;
			}
		}

		return {
			...makeOk(checkedAt, nowMs() - started),
			phases: { writeMs, readMs, deleteMs },
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "storage read/write check failed";
		return {
			...makeNg(checkedAt, nowMs() - started, message),
			phases: { writeMs, readMs, deleteMs },
		};
	}
}

async function runBackendCheckCore(): Promise<HealthCheckResult> {
	const started = nowMs();
	const checkedAt = new Date().toISOString();
	const [db, redis] = await Promise.all([
		runDbCheck(),
		runRedisCheck(),
	]);
	const ok = db.ok && redis.ok;
	return {
		ok,
		status: ok ? 200 : 503,
		cached: false,
		checkedAt,
		latencyMs: nowMs() - started,
		reason: ok
			? undefined
			: [!db.ok ? "db" : "", !redis.ok ? "redis" : ""]
					.filter(Boolean)
					.join(","),
		components: {
			db,
			redis,
		},
	};
}
// #endregion

// #region 公開API
export async function runDbCheck(): Promise<HealthCheckResult> {
	return await runWithCache("db", runDbCheckCore);
}

export async function runRedisCheck(): Promise<HealthCheckResult> {
	return await runWithCache("redis", runRedisCheckCore);
}

export async function runStorageCheck(): Promise<HealthCheckResult> {
	return await runWithCache("storage", runStorageCheckCore, TEN_MINUTES_MS);
}

export async function runBackendCheck(): Promise<HealthCheckResult> {
	return await runWithCache("backend", runBackendCheckCore);
}

export function runLiveCheck(): HealthCheckResult {
	const checkedAt = new Date().toISOString();
	return {
		ok: true,
		status: 200,
		cached: false,
		checkedAt,
		latencyMs: 0,
	};
}
// #endregion
