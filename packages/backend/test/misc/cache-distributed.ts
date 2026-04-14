/**
 * @packageDocumentation
 *
 * `Cache.fetch` / `fetchMaybe` の分散インフライト経路テスト。
 *
 * @internal
 */
import * as assert from "assert";
import config from "../../src/config/index.js";
import {
	Cache,
	setCacheDistributedAdapterForTests,
} from "../../src/misc/cache.js";
import type { DistributedSingleflightAdapter } from "../../src/misc/distributed-singleflight.js";

type InMemoryBus = {
	locks: Map<string, string>;
	results: Map<string, string>;
	waiters: Map<string, Array<(token: string) => void>>;
};

function createBus(): InMemoryBus {
	return {
		locks: new Map(),
		results: new Map(),
		waiters: new Map(),
	};
}

function createAdapter(bus: InMemoryBus, disableSignal = false): DistributedSingleflightAdapter {
	return {
		tryAcquireLock: async (lockKey, token) => {
			if (bus.locks.has(lockKey)) return false;
			bus.locks.set(lockKey, token);
			return true;
		},
		extendLock: async () => true,
		releaseLock: async (lockKey, token) => {
			if (bus.locks.get(lockKey) === token) {
				bus.locks.delete(lockKey);
			}
		},
		getResult: async (resultKey) => bus.results.get(resultKey) ?? null,
		setResult: async (resultKey, payload) => {
			bus.results.set(resultKey, payload);
		},
		publishDone: async (channel, token) => {
			const arr = bus.waiters.get(channel) ?? [];
			for (const wake of arr) wake(token);
			bus.waiters.delete(channel);
		},
		waitForSignal: async (channel, _token, timeoutMs) => {
			if (disableSignal) return null;
			return await new Promise<string | null>((resolve) => {
				const timer = setTimeout(() => resolve(null), timeoutMs);
				const arr = bus.waiters.get(channel) ?? [];
				arr.push((signalToken) => {
					clearTimeout(timer);
					resolve(signalToken);
				});
				bus.waiters.set(channel, arr);
			});
		},
	};
}

describe("cache / distributed inflight", () => {
	const createCache = (): Cache<number> => new Cache<number>(60_000);
	let originalCacheConfig: typeof config.cache;

	beforeEach(() => {
		originalCacheConfig = config.cache
			? {
					...config.cache,
					distributedInflight: config.cache.distributedInflight
						? { ...config.cache.distributedInflight }
						: undefined,
			  }
			: undefined;
		config.cache = {
			...(config.cache ?? {}),
			distributedInflight: {
				...(config.cache?.distributedInflight ?? {}),
				enabled: true,
			},
		};
	});

	afterEach(() => {
		setCacheDistributedAdapterForTests(null);
		config.cache = originalCacheConfig;
	});

	it("正常系：別インスタンス間でも同一キーは1回だけ実行される", async () => {
		const bus = createBus();
		setCacheDistributedAdapterForTests(createAdapter(bus));
		const cacheA = createCache();
		const cacheB = createCache();
		let calls = 0;

		const [a, b] = await Promise.all([
			cacheA.fetch("same-key", async () => {
				calls += 1;
				await new Promise((r) => setTimeout(r, 30));
				return 10;
			}),
			cacheB.fetch("same-key", async () => {
				calls += 1;
				await new Promise((r) => setTimeout(r, 30));
				return 10;
			}),
		]);

		assert.strictEqual(a, 10);
		assert.strictEqual(b, 10);
		assert.strictEqual(calls, 1);
	});

	it("フォールバック：通知不達時はポーリング経由で結果を取得できる", async () => {
		const bus = createBus();
		setCacheDistributedAdapterForTests(createAdapter(bus, true));
		const cacheA = createCache();
		const cacheB = createCache();
		let calls = 0;

		const [a, b] = await Promise.all([
			cacheA.fetch("polling-key", async () => {
				calls += 1;
				await new Promise((r) => setTimeout(r, 40));
				return 22;
			}),
			cacheB.fetch("polling-key", async () => {
				calls += 1;
				await new Promise((r) => setTimeout(r, 40));
				return 22;
			}),
		]);

		assert.strictEqual(a, 22);
		assert.strictEqual(b, 22);
		assert.strictEqual(calls, 1);
	});

	it("正常系：fetchMaybe で undefined はキャッシュされない", async () => {
		const bus = createBus();
		setCacheDistributedAdapterForTests(createAdapter(bus));
		const cache = new Cache<number>(60_000);
		let calls = 0;

		const first = await cache.fetchMaybe("maybe-key", async () => {
			calls += 1;
			return undefined;
		});
		const second = await cache.fetchMaybe("maybe-key", async () => {
			calls += 1;
			return 5;
		});

		assert.strictEqual(first, undefined);
		assert.strictEqual(second, 5);
		assert.strictEqual(calls, 2);
	});

	it("正常系：fetchMaybe で undefined でも別インスタンス間で1回だけ実行される", async () => {
		const bus = createBus();
		setCacheDistributedAdapterForTests(createAdapter(bus));
		const cacheA = new Cache<number>(60_000);
		const cacheB = new Cache<number>(60_000);
		let calls = 0;

		const [a, b] = await Promise.all([
			cacheA.fetchMaybe("maybe-undefined-shared", async () => {
				calls += 1;
				await new Promise((r) => setTimeout(r, 20));
				return undefined;
			}),
			cacheB.fetchMaybe("maybe-undefined-shared", async () => {
				calls += 1;
				await new Promise((r) => setTimeout(r, 20));
				return undefined;
			}),
		]);

		assert.strictEqual(a, undefined);
		assert.strictEqual(b, undefined);
		assert.strictEqual(calls, 1);
	});

	it("異常系：serialize 失敗時でも fetcher は再実行されない", async () => {
		let lockTtlMsObserved = 0;
		const adapter: DistributedSingleflightAdapter = {
			tryAcquireLock: async (_lockKey, _token, lockTtlMs) => {
				lockTtlMsObserved = lockTtlMs;
				return true;
			},
			extendLock: async () => true,
			releaseLock: async () => undefined,
			getResult: async () => null,
			setResult: async () => {
				throw new Error("set-result-failed");
			},
			publishDone: async () => undefined,
			waitForSignal: async () => null,
		};
		setCacheDistributedAdapterForTests(adapter);
		const cache = new Cache<bigint>(60_000);
		let calls = 0;

		let thrown = false;
		try {
			await cache.fetch("serialize-failed", async () => {
				calls += 1;
				return 42n;
			});
		} catch {
			thrown = true;
		}

		assert.strictEqual(thrown, true);
		assert.strictEqual(calls, 1);
		assert.strictEqual(lockTtlMsObserved > 0, true);
	});

	it("設定反映：enabled=false の場合は分散アダプターを使わない", async () => {
		config.cache = {
			...(config.cache ?? {}),
			distributedInflight: {
				...(config.cache?.distributedInflight ?? {}),
				enabled: false,
			},
		};

		let lockCalls = 0;
		setCacheDistributedAdapterForTests({
			tryAcquireLock: async () => {
				lockCalls += 1;
				return true;
			},
			extendLock: async () => true,
			releaseLock: async () => undefined,
			getResult: async () => null,
			setResult: async () => undefined,
			publishDone: async () => undefined,
			waitForSignal: async () => null,
		});

		const cache = createCache();
		const value = await cache.fetch("disabled-distributed", async () => 99);
		assert.strictEqual(value, 99);
		assert.strictEqual(lockCalls, 0);
	});

	it("設定反映：lockTtlSec が lock 取得 TTL ミリ秒に反映される", async () => {
		config.cache = {
			...(config.cache ?? {}),
			distributedInflight: {
				...(config.cache?.distributedInflight ?? {}),
				enabled: true,
				lockTtlSec: 7,
			},
		};

		let observedLockTtlMs = 0;
		setCacheDistributedAdapterForTests({
			tryAcquireLock: async (_lockKey, _token, lockTtlMs) => {
				observedLockTtlMs = lockTtlMs;
				return true;
			},
			extendLock: async () => true,
			releaseLock: async () => undefined,
			getResult: async () => null,
			setResult: async () => undefined,
			publishDone: async () => undefined,
			waitForSignal: async () => null,
		});

		const cache = createCache();
		const value = await cache.fetch("lock-ttl-reflect", async () => 1);
		assert.strictEqual(value, 1);
		assert.strictEqual(observedLockTtlMs, 7000);
	});
});
