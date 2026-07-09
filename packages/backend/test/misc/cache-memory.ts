/**
 * @packageDocumentation
 *
 * `Cache` の LRU 件数上限・TTL sweep のユニットテスト。
 *
 * @internal
 */
import * as assert from "assert";
import config from "../../src/config/index.js";
import { Cache } from "../../src/misc/cache.js";

describe("cache / memory bounds", () => {
	let originalCacheConfig: typeof config.cache;

	beforeEach(() => {
		originalCacheConfig = config.cache
			? {
					...config.cache,
					distributedInflight: config.cache.distributedInflight
						? { ...config.cache.distributedInflight }
						: undefined,
					memory: config.cache.memory ? { ...config.cache.memory } : undefined,
			  }
			: undefined;
		config.cache = {
			...(config.cache ?? {}),
			memory: {
				...(config.cache?.memory ?? {}),
				sweepIntervalMs: 0,
			},
		};
	});

	afterEach(() => {
		config.cache = originalCacheConfig;
	});

	it("LRU：maxEntries を超えると最古のキーが追い出される", () => {
		const cache = new Cache<number>(60_000, { maxEntries: 2 });
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);

		assert.strictEqual(cache.get("a"), undefined);
		assert.strictEqual(cache.get("b"), 2);
		assert.strictEqual(cache.get("c"), 3);
		assert.strictEqual(cache.size, 2);
	});

	it("LRU touch：get で参照したキーは追い出し対象から外れる", () => {
		const cache = new Cache<number>(60_000, { maxEntries: 2 });
		cache.set("a", 1);
		cache.set("b", 2);
		assert.strictEqual(cache.get("a"), 1);
		cache.set("c", 3);

		assert.strictEqual(cache.get("b"), undefined);
		assert.strictEqual(cache.get("a"), 1);
		assert.strictEqual(cache.get("c"), 3);
	});

	it("sweep：TTL 失効後に get せず sweepExpired で削除される", async () => {
		const cache = new Cache<number>(50, { maxEntries: 100 });
		cache.set("a", 1);
		await new Promise((resolve) => setTimeout(resolve, 60));

		assert.strictEqual(cache.sweepExpired(), 1);
		assert.strictEqual(cache.size, 0);
		assert.strictEqual(cache.get("a"), undefined);
	});

	it("Infinity TTL：期限切れにならないが maxEntries で追い出される", () => {
		const cache = new Cache<number>(Infinity, { maxEntries: 2 });
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);

		assert.strictEqual(cache.get("a"), undefined);
		assert.strictEqual(cache.get("b"), 2);
		assert.strictEqual(cache.get("c"), 3);
		assert.strictEqual(cache.sweepExpired(), 0);
	});
});
