/**
 * @packageDocumentation
 *
 * Redis を用いたロック取得（AP オブジェクト・インスタンスメタ・チャート挿入用）。
 *
 * @remarks
 * - **役割**: getApLock・getChartLock 等で Redis の Mutex を取得し、同一キーでの並行処理を排他する。
 *
 * @see {@link db/redis} Redis クライアント
 * @internal
 */
import { redisClient } from "../db/redis.js";
import { Mutex } from "redis-semaphore";

/** ロック取得のリトライ間隔（ミリ秒） */
const retryDelay = 100;

/**
 * AP オブジェクト用ロックを取得する。
 * @param uri - AP オブジェクトの ID（URI）
 * @param timeout - ロックのタイムアウト（ミリ秒）。経過で前のロックが解放される。
 * @returns ロック（Mutex）。解放は呼び出し側で行う。
 * @internal
 */
export async function getApLock(
	uri: string,
	timeout = 15 * 1000,
): Promise<Mutex> {
	const lock = new Mutex(redisClient, `ap-object:${uri}`, {
		lockTimeout: timeout,
		retryInterval: retryDelay,
	});
	await lock.acquire();
	return lock;
}

/**
 * インスタンスメタデータ取得用ロックを取得する。
 * @param host - ホスト名
 * @param timeout - ロックのタイムアウト（ミリ秒）
 * @returns ロック（Mutex）
 * @internal
 */
export async function getFetchInstanceMetadataLock(
	host: string,
	timeout = 10 * 1000,
): Promise<Mutex> {
	const lock = new Mutex(redisClient, `instance:${host}`, {
		lockTimeout: timeout,
		retryInterval: retryDelay,
	});
	await lock.acquire();
	return lock;
}

/**
 * チャート挿入用ロックを取得する。
 * @param lockKey - ロックキー
 * @param timeout - ロックのタイムアウト（ミリ秒）
 * @returns ロック（Mutex）
 * @internal
 */
export async function getChartInsertLock(
	lockKey: string,
	timeout = 15 * 1000,
): Promise<Mutex> {
	const lock = new Mutex(redisClient, `chart-insert:${lockKey}`, {
		lockTimeout: timeout,
		retryInterval: retryDelay,
	});
	await lock.acquire();
	return lock;
}
