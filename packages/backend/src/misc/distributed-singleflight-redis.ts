/**
 * @packageDocumentation
 *
 * Redis を使った分散 singleflight 用アダプターを提供する。
 *
 * @remarks
 * - **役割**: `distributed-singleflight.ts` の `DistributedSingleflightAdapter` 実装を共通化する。
 * - **方針**: Redis 例外は呼び出し側でフェイルオープンできるよう、各操作は例外を上位へ投げる。
 *
 * @internal
 */
import { redisClient } from "@/db/redis.js";
import type { DistributedSingleflightAdapter } from "@/misc/distributed-singleflight.js";

let sharedSubscriber: ReturnType<typeof redisClient.duplicate> | null = null;
const channelRefCounts = new Map<string, number>();
const channelOps = new Map<string, Promise<void>>();

function getSharedSubscriber(): ReturnType<typeof redisClient.duplicate> {
	if (!sharedSubscriber) {
		sharedSubscriber = redisClient.duplicate();
	}
	return sharedSubscriber;
}

function buildChannelName(namespace: string, channel: string): string {
	return `${namespace}:${channel}`;
}

/**
 * 同一チャンネルの subscribe/unsubscribe を直列化して実行する。
 *
 * @param channel - 完全な Pub/Sub チャンネル名
 * @param op - 実行する処理
 * @returns 直列化された完了 Promise
 * @internal
 */
async function enqueueChannelOp(channel: string, op: () => Promise<void>): Promise<void> {
	const prev = channelOps.get(channel) ?? Promise.resolve();
	const next = prev
		.catch(() => undefined)
		.then(op)
		.finally(() => {
			if (channelOps.get(channel) === next) {
				channelOps.delete(channel);
			}
		});
	channelOps.set(channel, next);
	return await next;
}

/**
 * チャンネル参照を 1 増やし、必要時のみ subscribe する。
 *
 * @param sub - 共有 subscriber
 * @param fullChannel - 完全な Pub/Sub チャンネル名
 * @internal
 */
async function retainChannel(
	sub: ReturnType<typeof redisClient.duplicate>,
	fullChannel: string,
): Promise<void> {
	await enqueueChannelOp(fullChannel, async () => {
		const current = channelRefCounts.get(fullChannel) ?? 0;
		if (current === 0) {
			await sub.subscribe(fullChannel);
		}
		channelRefCounts.set(fullChannel, current + 1);
	});
}

/**
 * チャンネル参照を 1 減らし、参照 0 のときのみ unsubscribe する。
 *
 * @param sub - 共有 subscriber
 * @param fullChannel - 完全な Pub/Sub チャンネル名
 * @internal
 */
async function releaseChannel(
	sub: ReturnType<typeof redisClient.duplicate>,
	fullChannel: string,
): Promise<void> {
	await enqueueChannelOp(fullChannel, async () => {
		const current = channelRefCounts.get(fullChannel) ?? 0;
		if (current <= 1) {
			channelRefCounts.delete(fullChannel);
			await sub.unsubscribe(fullChannel);
			return;
		}
		channelRefCounts.set(fullChannel, current - 1);
	});
}

/**
 * Redis ベースの分散 singleflight アダプターを生成する。
 *
 * @param namespace - Pub/Sub チャンネル接頭辞
 * @returns 共通利用できる Redis アダプター
 * @internal
 */
export function createRedisDistributedSingleflightAdapter(
	namespace: string,
): DistributedSingleflightAdapter {
	return {
		tryAcquireLock: async (lockKey: string, token: string, lockTtlMs: number): Promise<boolean> => {
			const r = await redisClient.set(lockKey, token, "PX", lockTtlMs, "NX");
			return r === "OK";
		},
		extendLock: async (lockKey: string, token: string, lockTtlMs: number): Promise<boolean> => {
			const result = await redisClient.eval(
				"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
				1,
				lockKey,
				token,
				String(lockTtlMs),
			);
			return Number(result) === 1;
		},
		releaseLock: async (lockKey: string, token: string): Promise<void> => {
			await redisClient.eval(
				"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
				1,
				lockKey,
				token,
			);
		},
		getResult: async (resultKey: string): Promise<string | null> => {
			return await redisClient.get(resultKey);
		},
		setResult: async (resultKey: string, payload: string, resultTtlSec: number): Promise<void> => {
			await redisClient.set(resultKey, payload, "EX", resultTtlSec);
		},
		publishDone: async (channel: string, token: string): Promise<void> => {
			await redisClient.publish(buildChannelName(namespace, channel), token);
		},
		waitForSignal: async (
			channel: string,
			_token: string,
			timeoutMs: number,
		): Promise<string | null> => {
			const sub = getSharedSubscriber();
			const fullChannel = buildChannelName(namespace, channel);
			return await new Promise<string | null>((resolve) => {
				let done = false;
				const cleanup = (): void => {
					sub.off("message", onMessage);
					void releaseChannel(sub, fullChannel);
				};
				const finish = (signalToken: string | null): void => {
					if (done) return;
					done = true;
					clearTimeout(timer);
					cleanup();
					resolve(signalToken);
				};
				const onMessage = (incomingChannel: string, message: string): void => {
					if (incomingChannel === fullChannel) {
						finish(message);
					}
				};
				const timer = setTimeout(() => finish(null), timeoutMs);
				sub.on("message", onMessage);
				void retainChannel(sub, fullChannel).catch(() => finish(null));
			});
		},
	};
}
