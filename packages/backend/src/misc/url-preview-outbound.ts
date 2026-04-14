/**
 * @packageDocumentation
 *
 * `/url` プレビュー取得の外向き HTTP を抑える（共有キャッシュ・インフライト・ホスト単位セマフォ・ネガティブキャッシュ）。
 *
 * @remarks
 * - **役割**: `urlPreviewHandler` から利用。Redis が無い／失敗時はメモリキャッシュのみにフォールバック。
 * - **計画外**: Summaly とセンシティブ用 GET の HTML 1 本化は行わない。
 * - **関連**: TTL の純粋計算は `url-preview-negative-ttl.ts` に分離（テストで config を読まないため）。
 *
 * @see {@link urlPreviewHandler} Web の URL プレビュー
 * @internal
 */

import * as crypto from "node:crypto";
import pLimit from "p-limit";
import config from "@/config/index.js";
import { redisClient } from "@/db/redis.js";
import { Cache } from "@/misc/cache.js";
import { resolveNegativeCacheTtlSecFromOpts } from "@/misc/url-preview-negative-ttl.js";
import Logger from "@/services/logger.js";

export { parseRetryAfterSeconds } from "@/misc/url-preview-negative-ttl.js";

const logger = new Logger("url-preview-outbound");

/** Redis キー接尾辞（keyPrefix は redisClient 側で付与） */
const REDIS_OK_PREFIX = "urlPreviewOk:v1:";
const REDIS_NEG_PREFIX = "urlPreviewNeg:v1:";

/** インフライト結合（同一プロセス内） */
const inflight = new Map<string, Promise<unknown>>();

/** ホスト名 → p-limit インスタンス（上限なしのときは未登録） */
const hostLimiters = new Map<string, ReturnType<typeof pLimit>>();

let globalLimiter: ReturnType<typeof pLimit> | null = null;

/** `config.urlPreview` と既定値をマージした実行時オプション。 */
type UrlPreviewOutboundOpts = {
	cacheEnabled: boolean;
	redisOkTtlSec: number;
	memoryOkTtlMs: number;
	negativeDefaultSec: number;
	negativeMinSec: number;
	negativeMaxSec: number;
	negative5xxSec: number;
	maxConcurrentPerHost: number;
	maxGlobalConcurrent: number;
	shortUrlResolveTtlSec: number;
};

function getUrlPreviewOpts(): UrlPreviewOutboundOpts {
	const o = config.urlPreview;
	return {
		cacheEnabled: o?.cacheEnabled !== false,
		redisOkTtlSec: o?.redisOkTtlSec ?? 900,
		memoryOkTtlMs: o?.memoryOkTtlMs ?? 15 * 60 * 1000,
		negativeDefaultSec: o?.negativeDefaultSec ?? 120,
		negativeMinSec: o?.negativeMinSec ?? 30,
		negativeMaxSec: o?.negativeMaxSec ?? 3600,
		negative5xxSec: o?.negative5xxSec ?? 90,
		maxConcurrentPerHost: o?.maxConcurrentPerHost ?? 4,
		maxGlobalConcurrent: o?.maxGlobalConcurrent ?? 32,
		shortUrlResolveTtlSec: o?.shortUrlResolveTtlSec ?? 300,
	};
}

let memoryOkCache: Cache<string> | null = null;

function getMemoryOkCache(): Cache<string> {
	if (!memoryOkCache) {
		memoryOkCache = new Cache<string>(getUrlPreviewOpts().memoryOkTtlMs);
	}
	return memoryOkCache;
}

/**
 * 正規化 URL・言語・Summaly 経路からキャッシュキー用ハッシュを作る。
 */
export function buildUrlPreviewCacheKey(
	summaryFetchUrl: string,
	lang: string,
	summalyProxy: string | null,
): string {
	const raw = `${summaryFetchUrl}\n${lang}\n${summalyProxy ?? ""}`;
	return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * 失敗時ネガティブキャッシュの TTL（秒）を決める。
 */
export function resolveNegativeCacheTtlSec(err: unknown): number {
	const o = getUrlPreviewOpts();
	return resolveNegativeCacheTtlSecFromOpts(
		{
			negativeDefaultSec: o.negativeDefaultSec,
			negativeMinSec: o.negativeMinSec,
			negativeMaxSec: o.negativeMaxSec,
			negative5xxSec: o.negative5xxSec,
		},
		err,
	);
}

async function redisGet(key: string): Promise<string | null> {
	try {
		return await redisClient.get(key);
	} catch (e) {
		logger.debug(`redis get failed for ${key}: ${e}`);
		return null;
	}
}

async function redisSetex(key: string, sec: number, value: string): Promise<void> {
	try {
		await redisClient.set(key, value, "EX", sec);
	} catch (e) {
		logger.debug(`redis setex failed for ${key}: ${e}`);
	}
}

/**
 * 成功レスポンス JSON 文字列が Redis にあれば返す。
 */
export async function tryGetPositiveRedis(cacheKeyHash: string): Promise<string | null> {
	const o = getUrlPreviewOpts();
	if (!o.cacheEnabled) return null;
	return redisGet(`${REDIS_OK_PREFIX}${cacheKeyHash}`);
}

/**
 * ネガティブキャッシュがあれば true。
 */
export async function tryGetNegativeRedis(cacheKeyHash: string): Promise<boolean> {
	const o = getUrlPreviewOpts();
	if (!o.cacheEnabled) return false;
	const v = await redisGet(`${REDIS_NEG_PREFIX}${cacheKeyHash}`);
	return v === "1";
}

/**
 * 成功したプレビュー JSON を Redis とメモリに保存する。
 */
export async function storePositiveCaches(
	cacheKeyHash: string,
	jsonBody: string,
): Promise<void> {
	const o = getUrlPreviewOpts();
	if (!o.cacheEnabled) return;
	await redisSetex(`${REDIS_OK_PREFIX}${cacheKeyHash}`, o.redisOkTtlSec, jsonBody);
	getMemoryOkCache().set(cacheKeyHash, jsonBody);
}

/**
 * メモリのみの成功キャッシュ取得。
 */
export function tryGetPositiveMemory(cacheKeyHash: string): string | undefined {
	const o = getUrlPreviewOpts();
	if (!o.cacheEnabled) return undefined;
	return getMemoryOkCache().get(cacheKeyHash);
}

/**
 * Redis ヒット時などにメモリキャッシュだけを温める。
 */
export function storePositiveMemoryOnly(cacheKeyHash: string, jsonBody: string): void {
	const o = getUrlPreviewOpts();
	if (!o.cacheEnabled) return;
	getMemoryOkCache().set(cacheKeyHash, jsonBody);
}

/**
 * 失敗をネガティブキャッシュする。
 */
export async function storeNegativeRedis(
	cacheKeyHash: string,
	err: unknown,
): Promise<void> {
	const o = getUrlPreviewOpts();
	if (!o.cacheEnabled) return;
	const ttl = resolveNegativeCacheTtlSec(err);
	await redisSetex(`${REDIS_NEG_PREFIX}${cacheKeyHash}`, ttl, "1");
}

/**
 * 同一キャッシュキーで進行中の取得を 1 本にまとめる。
 */
export function withUrlPreviewInflight<T>(
	cacheKeyHash: string,
	factory: () => Promise<T>,
): Promise<T> {
	const existing = inflight.get(cacheKeyHash) as Promise<T> | undefined;
	if (existing) return existing;
	const p = factory().finally(() => {
		inflight.delete(cacheKeyHash);
	}) as Promise<T>;
	inflight.set(cacheKeyHash, p);
	return p;
}

/**
 * 設定に従いグローバル・ホスト単位のセマフォで fn を実行する。
 */
export async function withUrlPreviewOutboundLimits<T>(
	summaryFetchUrl: string,
	fn: () => Promise<T>,
): Promise<T> {
	const o = getUrlPreviewOpts();
	let hostname = "invalid.host";
	try {
		hostname = new URL(summaryFetchUrl).hostname;
	} catch {
		// フォールバックキー
	}

	const runHostLimited = async (): Promise<T> => {
		const mh = o.maxConcurrentPerHost;
		if (mh <= 0) {
			return fn();
		}
		let lim = hostLimiters.get(hostname);
		if (!lim) {
			lim = pLimit(mh);
			hostLimiters.set(hostname, lim);
		}
		return lim(fn);
	};

	const mg = o.maxGlobalConcurrent;
	if (mg <= 0) {
		return runHostLimited();
	}
	if (!globalLimiter) {
		globalLimiter = pLimit(mg);
	}
	return globalLimiter(runHostLimited);
}

// --- 短縮 URL 解決キャッシュ（同一ファイルで管理） ---

let shortUrlCache: Cache<string> | null = null;

function getShortUrlCache(): Cache<string> {
	const ttlMs = getUrlPreviewOpts().shortUrlResolveTtlSec * 1000;
	if (!shortUrlCache) {
		shortUrlCache = new Cache<string>(ttlMs);
	}
	return shortUrlCache;
}

/**
 * 短縮 URL 解決結果を TTL 付きでキャッシュするラッパー用キー。
 */
export function shortUrlResolveCacheKey(originalUrl: string): string {
	return crypto.createHash("sha256").update(originalUrl, "utf8").digest("hex");
}

/**
 * 短縮 URL 解決のキャッシュ付き取得（戻り値は `resolveShortUrlIfNeeded` と同じ意味）。
 */
export async function fetchShortUrlResolveCached(
	originalUrl: string,
	resolver: () => Promise<string | null>,
): Promise<string | null> {
	const o = getUrlPreviewOpts();
	if (!o.cacheEnabled) {
		return resolver();
	}
	const key = shortUrlResolveCacheKey(originalUrl);
	const cache = getShortUrlCache();
	const hit = cache.get(key);
	if (hit !== undefined) {
		return hit === "" ? null : hit;
	}
	const resolved = await resolver();
	cache.set(key, resolved ?? "");
	return resolved;
}
