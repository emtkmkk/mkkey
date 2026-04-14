/**
 * @packageDocumentation
 *
 * `distributed-singleflight` の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	runDistributedSingleflight,
	type DistributedSingleflightAdapter,
} from "../../src/misc/distributed-singleflight.js";

type MemoryBus = {
	locks: Map<string, string>;
	results: Map<string, string>;
	waiters: Map<string, Array<(token: string) => void>>;
};

function createMemoryBus(): MemoryBus {
	return {
		locks: new Map(),
		results: new Map(),
		waiters: new Map(),
	};
}

function createAdapter(
	bus: MemoryBus,
	opts?: {
		disableSignal?: boolean;
		throwOnLock?: boolean;
	},
): DistributedSingleflightAdapter {
	return {
		tryAcquireLock: async (lockKey, token) => {
			if (opts?.throwOnLock) {
				throw new Error("lock failed");
			}
			if (bus.locks.has(lockKey)) return false;
			bus.locks.set(lockKey, token);
			return true;
		},
		releaseLock: async (lockKey, token) => {
			if (bus.locks.get(lockKey) === token) {
				bus.locks.delete(lockKey);
			}
		},
		getResult: async (resultKey) => {
			return bus.results.get(resultKey) ?? null;
		},
		setResult: async (resultKey, payload) => {
			bus.results.set(resultKey, payload);
		},
		publishDone: async (channel, token) => {
			const waiters = bus.waiters.get(channel) ?? [];
			for (const resume of waiters) resume(token);
			bus.waiters.delete(channel);
		},
		waitForSignal: async (channel, _token, timeoutMs) => {
			if (opts?.disableSignal) {
				return null;
			}
			return await new Promise<string | null>((resolve) => {
				const t = setTimeout(() => resolve(null), timeoutMs);
				const resume = (signalToken: string): void => {
					clearTimeout(t);
					resolve(signalToken);
				};
				const waiters = bus.waiters.get(channel) ?? [];
				waiters.push(resume);
				bus.waiters.set(channel, waiters);
			});
		},
	};
}

function testOptions<T>(
	adapter: DistributedSingleflightAdapter,
	key: string,
	factory: () => Promise<T>,
) {
	return {
		scope: "test-scope",
		key,
		adapter,
		factory,
		serialize: (value: T) => JSON.stringify(value),
		deserialize: (raw: string) => JSON.parse(raw) as T,
		lockTtlSec: 3,
		resultTtlSec: 5,
		waitTimeoutMs: 200,
		pubsubTimeoutMs: 30,
		pollIntervalMs: 10,
		pollJitterRatio: 0,
		lockExtendIntervalMs: 0,
		maxLockExtendCount: 0,
	};
}

describe("distributed-singleflight / runDistributedSingleflight", () => {
	it("正常系：同一キー同時実行で leader の結果を follower が受け取る", async () => {
		const bus = createMemoryBus();
		const adapter = createAdapter(bus);
		let calls = 0;
		const factory = async () => {
			calls += 1;
			await new Promise((r) => setTimeout(r, 30));
			return { value: 42 };
		};

		const [a, b] = await Promise.all([
			runDistributedSingleflight(testOptions(adapter, "same", factory)),
			runDistributedSingleflight(testOptions(adapter, "same", factory)),
		]);

		assert.deepStrictEqual(a, { value: 42 });
		assert.deepStrictEqual(b, { value: 42 });
		assert.strictEqual(calls, 1);
	});

	it("フォールバック：通知が来なくてもポーリングで結果を取得できる", async () => {
		const bus = createMemoryBus();
		const leaderAdapter = createAdapter(bus, { disableSignal: true });
		const followerAdapter = createAdapter(bus, { disableSignal: true });
		let calls = 0;
		const factory = async () => {
			calls += 1;
			await new Promise((r) => setTimeout(r, 40));
			return "ok";
		};

		const [a, b] = await Promise.all([
			runDistributedSingleflight(testOptions(leaderAdapter, "poll", factory)),
			runDistributedSingleflight(testOptions(followerAdapter, "poll", factory)),
		]);

		assert.strictEqual(a, "ok");
		assert.strictEqual(b, "ok");
		assert.strictEqual(calls, 1);
	});

	it("異常系：ロック取得に失敗する場合は呼び出し側でフォールバック実行できる", async () => {
		const bus = createMemoryBus();
		const broken = createAdapter(bus, { throwOnLock: true });
		let calls = 0;
		const factory = async () => {
			calls += 1;
			return 1;
		};

		let thrown = false;
		try {
			await runDistributedSingleflight(testOptions(broken, "err", factory));
		} catch {
			thrown = true;
		}
		assert.strictEqual(thrown, true);
		assert.strictEqual(calls, 0);
	});

	it("正常系：通知 token と result token が一致すると follower が結果を受け取る", async () => {
		const token = `${Date.now()}-matched-token`;
		const adapter: DistributedSingleflightAdapter = {
			tryAcquireLock: async () => false,
			releaseLock: async () => undefined,
			getResult: async () =>
				JSON.stringify({
					token,
					value: JSON.stringify("matched-result"),
					completedAt: Date.now(),
				}),
			setResult: async () => undefined,
			publishDone: async () => undefined,
			waitForSignal: async () => token,
		};
		let calls = 0;

		const result = await runDistributedSingleflight(
			testOptions(adapter, "token-match", async () => {
				calls += 1;
				return "fallback-local";
			}),
		);

		assert.strictEqual(result, "matched-result");
		assert.strictEqual(calls, 0);
	});

	it("正常系：通知 token と result token が不一致なら採用しない", async () => {
		const bus = createMemoryBus();
		const adapter: DistributedSingleflightAdapter = {
			tryAcquireLock: async () => false,
			releaseLock: async () => undefined,
			getResult: async () =>
				JSON.stringify({
					token: `${Date.now()}-result-token`,
					value: JSON.stringify("stale-by-token"),
					completedAt: Date.now(),
				}),
			setResult: async () => undefined,
			publishDone: async () => undefined,
			waitForSignal: async () => `${Date.now()}-signal-token`,
		};
		let calls = 0;

		const result = await runDistributedSingleflight(
			testOptions(adapter, "token-mismatch", async () => {
				calls += 1;
				return "fallback-local";
			}),
		);

		assert.strictEqual(result, "fallback-local");
		assert.strictEqual(calls, 1);
	});

	it("正常系：通知なしポーリング時は待機開始前の古い結果を採用しない", async () => {
		const bus = createMemoryBus();
		const adapter = createAdapter(bus, { disableSignal: true });
		const key = "stale-on-poll";
		const resultKey = `test-scope:result:${key}`;
		bus.results.set(
			resultKey,
			JSON.stringify({
				token: `${Date.now() - 10_000}-old`,
				value: JSON.stringify("stale"),
				completedAt: Date.now() - 10_000,
			}),
		);
		let calls = 0;

		const result = await runDistributedSingleflight(
			testOptions(adapter, key, async () => {
				calls += 1;
				return "fresh";
			}),
		);

		assert.strictEqual(result, "fresh");
		assert.strictEqual(calls, 1);
	});

	it("正常系：同一チャンネル複数待機で片方が先に終わっても残りが通知を受け取る", async () => {
		const bus = createMemoryBus();
		const adapter = createAdapter(bus);
		let calls = 0;
		const factory = async () => {
			calls += 1;
			await new Promise((r) => setTimeout(r, 80));
			return "shared";
		};

		const fastWait = runDistributedSingleflight(
			testOptions(adapter, "multi-wait", factory),
		);
		const timeoutWait = runDistributedSingleflight({
			...testOptions(adapter, "multi-wait", factory),
			pubsubTimeoutMs: 10,
		});
		const lateWait = runDistributedSingleflight(
			testOptions(adapter, "multi-wait", factory),
		);

		const [a, b, c] = await Promise.all([fastWait, timeoutWait, lateWait]);
		assert.strictEqual(a, "shared");
		assert.strictEqual(b, "shared");
		assert.strictEqual(c, "shared");
		assert.strictEqual(calls, 1);
	});
});
