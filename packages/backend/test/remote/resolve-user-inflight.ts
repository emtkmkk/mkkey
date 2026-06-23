/**
 * @packageDocumentation
 *
 * `resolve-user-inflight` の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import config from "../../src/config/index.js";
import type { User } from "../../src/models/entities/user.js";
import {
	buildResolveUserInflightKey,
	withResolveUserInflight,
} from "../../src/remote/resolve-user-inflight.js";

describe("resolve-user-inflight", () => {
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
			distributedInflight: {
				enabled: false,
			},
		};
	});

	afterEach(() => {
		config.cache = originalCacheConfig;
	});

	it("buildResolveUserInflightKey は acct 形式のキーを返す", () => {
		const key = buildResolveUserInflightKey("alice", "misskey.io");
		assert.strictEqual(key, "resolve-user:v1:alice@misskey.io");
	});

	it("同一 acct への並行呼び出しの場合、factory は 1 回だけ実行される", async () => {
		let factoryCount = 0;
		const acctKey = buildResolveUserInflightKey("bob", "example.com");
		const factory = async (): Promise<User> => {
			factoryCount++;
			await new Promise((resolve) => setTimeout(resolve, 30));
			return { id: "user-bob" } as User;
		};

		const [first, second] = await Promise.all([
			withResolveUserInflight(acctKey, factory),
			withResolveUserInflight(acctKey, factory),
		]);

		assert.strictEqual(factoryCount, 1);
		assert.strictEqual(first.id, "user-bob");
		assert.strictEqual(second.id, "user-bob");
	});

	it("異なる acct キーの場合、factory はそれぞれ実行される", async () => {
		let factoryCount = 0;
		const factory = async (): Promise<User> => {
			factoryCount++;
			return { id: `user-${factoryCount}` } as User;
		};

		await Promise.all([
			withResolveUserInflight(
				buildResolveUserInflightKey("carol", "a.example"),
				factory,
			),
			withResolveUserInflight(
				buildResolveUserInflightKey("dave", "b.example"),
				factory,
			),
		]);

		assert.strictEqual(factoryCount, 2);
	});
});
