/**
 * @packageDocumentation
 *
 * `resolveUser` のリモート解決を acct 単位でインフライト結合する。
 *
 * @remarks
 * - **役割**: 同一 `usernameLower@host` への並行 resync / 新規作成を 1 本にまとめ、相手サーバーへの重複 HTTP を抑える。
 * - **分散**: プロセス内 Map に加え、既存の Redis 分散 singleflight を利用する（`config.cache.distributedInflight`）。
 * - **シリアライズ**: 分散 follower には `User.id` のみ渡し、完了後に DB から再取得する。
 *
 * @see {@link remote/resolve-user} 呼び出し元
 * @internal
 */

import config from "@/config/index.js";
import type { User } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import {
	runDistributedSingleflight,
	type DistributedSingleflightAdapter,
} from "@/misc/distributed-singleflight.js";
import { remoteLogger } from "./logger.js";

const logger = remoteLogger.createSubLogger("resolve-user-inflight");

const REDIS_DIST_SCOPE = "resolveUserInflight:v1";

/** 同一プロセス内の進行中解決 */
const inflight = new Map<string, Promise<User>>();

type ResolveUserDistributedOpts = {
	enabled: boolean;
	lockTtlSec: number;
	resultTtlSec: number;
	waitTimeoutMs: number;
	pubsubTimeoutMs: number;
	pollIntervalMs: number;
	pollJitterRatio: number;
	lockExtendIntervalMs: number;
	maxLockExtendCount: number;
};

let distributedAdapterOverride: DistributedSingleflightAdapter | null = null;
let distributedAdapterPromise: Promise<DistributedSingleflightAdapter> | null =
	null;

/**
 * 分散 singleflight 用の設定を取得する。
 *
 * @returns `config.cache.distributedInflight` を正規化した値
 * @internal
 */
function getResolveUserDistributedOpts(): ResolveUserDistributedOpts {
	const distributedConfig = config.cache?.distributedInflight;
	const lockTtlSecRaw = Number(distributedConfig?.lockTtlSec ?? "");
	const resultTtlSecRaw = Number(distributedConfig?.resultTtlSec ?? "");
	const waitTimeoutMsRaw = Number(distributedConfig?.waitTimeoutMs ?? "");
	const pubsubTimeoutMsRaw = Number(distributedConfig?.pubsubTimeoutMs ?? "");
	const pollIntervalMsRaw = Number(distributedConfig?.pollIntervalMs ?? "");
	const pollJitterRatioRaw = Number(distributedConfig?.pollJitterRatio ?? "");
	const lockExtendIntervalMsRaw = Number(
		distributedConfig?.lockExtendIntervalMs ?? "",
	);
	const maxLockExtendCountRaw = Number(
		distributedConfig?.maxLockExtendCount ?? "",
	);

	return {
		enabled: distributedConfig?.enabled !== false,
		lockTtlSec:
			Number.isFinite(lockTtlSecRaw) && lockTtlSecRaw > 0 ? lockTtlSecRaw : 15,
		resultTtlSec:
			Number.isFinite(resultTtlSecRaw) && resultTtlSecRaw > 0
				? resultTtlSecRaw
				: 20,
		waitTimeoutMs:
			Number.isFinite(waitTimeoutMsRaw) && waitTimeoutMsRaw > 0
				? waitTimeoutMsRaw
				: 8000,
		pubsubTimeoutMs:
			Number.isFinite(pubsubTimeoutMsRaw) && pubsubTimeoutMsRaw > 0
				? pubsubTimeoutMsRaw
				: 1200,
		pollIntervalMs:
			Number.isFinite(pollIntervalMsRaw) && pollIntervalMsRaw > 0
				? pollIntervalMsRaw
				: 150,
		pollJitterRatio:
			Number.isFinite(pollJitterRatioRaw) && pollJitterRatioRaw >= 0
				? pollJitterRatioRaw
				: 0.2,
		lockExtendIntervalMs:
			Number.isFinite(lockExtendIntervalMsRaw) && lockExtendIntervalMsRaw >= 0
				? lockExtendIntervalMsRaw
				: 5000,
		maxLockExtendCount:
			Number.isFinite(maxLockExtendCountRaw) && maxLockExtendCountRaw >= 0
				? maxLockExtendCountRaw
				: 2,
	};
}

async function getDefaultDistributedAdapter(): Promise<DistributedSingleflightAdapter> {
	if (!distributedAdapterPromise) {
		distributedAdapterPromise = import(
			"@/misc/distributed-singleflight-redis.js"
		).then((m) => m.createRedisDistributedSingleflightAdapter(REDIS_DIST_SCOPE));
	}
	return await distributedAdapterPromise;
}

/**
 * テスト用に分散アダプターを差し替える。
 *
 * @param adapter - 差し替え先（`null` で既定に戻す）
 * @internal
 */
export function setResolveUserInflightAdapterForTests(
	adapter: DistributedSingleflightAdapter | null,
): void {
	distributedAdapterOverride = adapter;
}

/**
 * インフライト結合キーを組み立てる。
 *
 * @param usernameLower - 小文字化済みユーザー名
 * @param host - puny 正規化済みホスト
 * @returns `resolve-user:v1:...` 形式のキー
 * @public
 */
export function buildResolveUserInflightKey(
	usernameLower: string,
	host: string,
): string {
	return `resolve-user:v1:${usernameLower}@${host}`;
}

/**
 * 分散 follower 用に `User.id` からユーザーを再取得する。
 *
 * @param userId - 解決済みユーザー ID
 * @returns DB 上のユーザー
 * @internal
 */
async function reloadUserById(userId: string): Promise<User> {
	return await Users.findOneByOrFail({ id: userId });
}

/**
 * 同一 acct への並行 `resolveUser` を 1 本にまとめる。
 *
 * @param acctKey - `buildResolveUserInflightKey` の戻り値
 * @param factory - 実際のリモート解決処理
 * @returns 解決されたユーザー
 * @public
 */
export function withResolveUserInflight(
	acctKey: string,
	factory: () => Promise<User>,
): Promise<User> {
	const existing = inflight.get(acctKey);
	if (existing) return existing;

	const pending = (async () => {
		const opts = getResolveUserDistributedOpts();
		if (!opts.enabled) {
			return await factory();
		}

		try {
			const userId = await runDistributedSingleflight<string>({
				scope: "resolve-user",
				key: acctKey,
				adapter: distributedAdapterOverride ?? (await getDefaultDistributedAdapter()),
				factory: async () => {
					const user = await factory();
					return user.id;
				},
				serialize: (value) => value,
				deserialize: (raw) => raw,
				lockTtlSec: opts.lockTtlSec,
				resultTtlSec: opts.resultTtlSec,
				waitTimeoutMs: opts.waitTimeoutMs,
				pubsubTimeoutMs: opts.pubsubTimeoutMs,
				pollIntervalMs: opts.pollIntervalMs,
				pollJitterRatio: opts.pollJitterRatio,
				lockExtendIntervalMs: opts.lockExtendIntervalMs,
				maxLockExtendCount: opts.maxLockExtendCount,
				onDebug: (message) => {
					logger.debug(message);
				},
			});
			return await reloadUserById(userId);
		} catch (e) {
			logger.debug(`distributed inflight fallback key=${acctKey}: ${e}`);
			return await factory();
		}
	})().finally(() => {
		inflight.delete(acctKey);
	});

	inflight.set(acctKey, pending);
	return pending;
}
