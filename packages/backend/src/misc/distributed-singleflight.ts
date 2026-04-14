/**
 * @packageDocumentation
 *
 * Redis などの共有ストアを使って、ワーカー横断で同一キー処理を 1 本にまとめる。
 *
 * @remarks
 * - **役割**: lock + result + notify（Hybrid: 通知待ち + ポーリング）を共通化し、呼び出し元の重複実装を減らす。
 * - **前提**: 同一キーで「leader 1 本 + follower 待機」を作る。障害時はフォールバック実行を許可する。
 * - **失敗時方針**: ストア操作で例外が起きても処理全体は止めない（フェイルオープン）。
 *
 * @internal
 */

/**
 * 分散インフライトのストア操作アダプター。
 *
 * @remarks
 * NOTE: `waitForSignal` は Pub/Sub など任意の通知実装を隠蔽する。受信した token を返し、失敗時は `null` を返してポーリングへ落とせる。
 *
 * @public
 */
export type DistributedSingleflightAdapter = {
	tryAcquireLock: (lockKey: string, token: string, lockTtlMs: number) => Promise<boolean>;
	extendLock?: (lockKey: string, token: string, lockTtlMs: number) => Promise<boolean>;
	releaseLock: (lockKey: string, token: string) => Promise<void>;
	getResult: (resultKey: string) => Promise<string | null>;
	setResult: (resultKey: string, payload: string, resultTtlSec: number) => Promise<void>;
	publishDone: (channel: string, token: string) => Promise<void>;
	waitForSignal: (channel: string, token: string, timeoutMs: number) => Promise<string | null>;
};

/**
 * 分散インフライト実行オプション。
 *
 * @public
 */
export type DistributedSingleflightOptions<T> = {
	scope: string;
	key: string;
	adapter: DistributedSingleflightAdapter;
	factory: () => Promise<T>;
	serialize: (value: T) => string;
	deserialize: (raw: string) => T;
	lockTtlSec: number;
	resultTtlSec: number;
	waitTimeoutMs: number;
	pubsubTimeoutMs: number;
	pollIntervalMs: number;
	pollJitterRatio: number;
	lockExtendIntervalMs: number;
	maxLockExtendCount: number;
	onDebug?: (message: string) => void;
};

type ResultEnvelope = {
	token: string;
	value: string;
	completedAt: number;
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeJitter(baseMs: number, ratio: number): number {
	if (ratio <= 0) return baseMs;
	const clampedRatio = Math.min(Math.max(ratio, 0), 0.9);
	const offset = (Math.random() * 2 - 1) * baseMs * clampedRatio;
	return Math.max(1, Math.round(baseMs + offset));
}

/**
 * ワーカー横断の singleflight を実行する。
 *
 * @remarks
 * - まず lock を取り leader を決める。
 * - follower は通知待ちし、取れなければポーリングへフォールバックする。
 * - 待機時間内に結果が無ければ lock 再競争を 1 回だけ行い、それでも不可ならローカル実行へ落とす。
 *
 * @param opts - 実行設定
 * @returns leader または follower が得た処理結果
 * @public
 */
export async function runDistributedSingleflight<T>(
	opts: DistributedSingleflightOptions<T>,
): Promise<T> {
	const {
		scope,
		key,
		adapter,
		factory,
		serialize,
		deserialize,
		lockTtlSec,
		resultTtlSec,
		waitTimeoutMs,
		pubsubTimeoutMs,
		pollIntervalMs,
		pollJitterRatio,
		lockExtendIntervalMs,
		maxLockExtendCount,
		onDebug,
	} = opts;

	const lockKey = `${scope}:lock:${key}`;
	const resultKey = `${scope}:result:${key}`;
	const channel = `${scope}:ch:${key}`;
	const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

	const debug = (message: string): void => {
		onDebug?.(message);
	};

	const readEnvelope = async (): Promise<ResultEnvelope | null> => {
		const raw = await adapter.getResult(resultKey);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw) as Partial<ResultEnvelope>;
			if (typeof parsed.token !== "string") return null;
			if (typeof parsed.value !== "string") return null;
			if (!Number.isFinite(parsed.completedAt)) return null;
			return {
				token: parsed.token,
				value: parsed.value,
				completedAt: Number(parsed.completedAt),
			};
		} catch {
			return null;
		}
	};

	const runAsLeader = async (): Promise<T> => {
		let extendTimer: ReturnType<typeof setInterval> | null = null;
		let extendCount = 0;
		try {
			if (adapter.extendLock && lockExtendIntervalMs > 0 && maxLockExtendCount > 0) {
				extendTimer = setInterval(() => {
					if (extendCount >= maxLockExtendCount) return;
					extendCount += 1;
					void adapter.extendLock!(lockKey, token, lockTtlSec * 1000).catch(() => {
						debug(`lock_extend_failed key=${key} count=${extendCount}`);
					});
				}, lockExtendIntervalMs);
			}

			const value = await factory();
			const payload = JSON.stringify({
				token,
				value: serialize(value),
				completedAt: Date.now(),
			} satisfies ResultEnvelope);
			await adapter.setResult(resultKey, payload, resultTtlSec);
			await adapter.publishDone(channel, token);
			debug(`pubsub_notified key=${key}`);
			debug(`leader_done key=${key}`);
			return value;
		} finally {
			if (extendTimer) clearInterval(extendTimer);
			await adapter.releaseLock(lockKey, token);
		}
	};

	const tryFollowerWait = async (): Promise<T | null> => {
		const startedAt = Date.now();
		let expectedTokenFromSignal: string | undefined;
		const tryUseEnvelope = (
			env: ResultEnvelope | null,
			expectedToken?: string,
		): { matched: false } | { matched: true; value: T } => {
			if (!env) return { matched: false };
			// NOTE: follower 自身の token と一致する payload は想定外なので採用しない。
			if (env.token === token) return { matched: false };
			if (expectedToken !== undefined && env.token !== expectedToken) return { matched: false };
			// NOTE: 通知なしポーリング時は、待機開始前に完了した古い結果を採用しない。
			if (expectedToken === undefined && env.completedAt < startedAt) return { matched: false };
			return { matched: true, value: deserialize(env.value) };
		};
		const receivedToken = await adapter.waitForSignal(channel, token, pubsubTimeoutMs);
		if (receivedToken !== null) {
			expectedTokenFromSignal = receivedToken;
			debug(`follower_signal_received key=${key}`);
			const env = await readEnvelope();
			const result = tryUseEnvelope(env, receivedToken);
			if (result.matched) {
				return result.value;
			}
		}
		debug(`poll_fallback key=${key}`);

		while (Date.now() - startedAt < waitTimeoutMs) {
			const env = await readEnvelope();
			const result = tryUseEnvelope(env, expectedTokenFromSignal);
			if (result.matched) {
				debug(`follower_polled_result key=${key}`);
				return result.value;
			}
			await sleep(makeJitter(pollIntervalMs, pollJitterRatio));
		}
		return null;
	};

	const acquired = await adapter.tryAcquireLock(lockKey, token, lockTtlSec * 1000);
	if (acquired) {
		debug(`lock_acquired key=${key}`);
		return runAsLeader();
	}

	debug(`lock_contended key=${key}`);
	const waited = await tryFollowerWait();
	if (waited !== null) {
		return waited;
	}

	debug(`wait_timeout key=${key}`);
	const reacquired = await adapter.tryAcquireLock(lockKey, token, lockTtlSec * 1000);
	if (reacquired) {
		debug(`lock_reacquired key=${key}`);
		return runAsLeader();
	}

	debug(`fallback_local_run key=${key}`);
	return factory();
}
