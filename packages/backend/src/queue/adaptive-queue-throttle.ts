/**
 * @packageDocumentation
 *
 * キュー処理に負荷ベースの適応的ディレイを挟むラッパ。
 *
 * @remarks
 * - Bull に登録するときは常に Promise スタイル（`job` のみ）で返す。
 * - 元プロセッサがコールバックスタイル（`job, done`）の場合は、
 *   {@link invokeProcessor} で合成 `done` を渡し完了を待つ。
 * - NOTE: ラップ後は関数の `length` が 1 になるため、Bull 本体は
 *   `done` を渡さない。ここできちんと橋渡ししないと
 *   `TypeError: done is not a function` になる。
 *
 * @internal
 */
import type Bull from "bull";
import config from "@/config/index.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Promise スタイルのプロセッサ（`job` のみ）。
 *
 * @internal
 */
type PromiseProcessor<T> = (job: Bull.Job<T>) => Promise<unknown>;

/**
 * コールバック / Promise どちらでも受け取る元プロセッサ。
 *
 * @remarks
 * Bull と同様に `processor.length > 1` なら `done` 付きとみなす。
 *
 * @internal
 */
type AnyProcessor<T> =
	| PromiseProcessor<T>
	| ((job: Bull.Job<T>, done: Bull.DoneCallback) => void | Promise<void>);

type QueueState = {
	latencyEma: number;
	errorEma: number;
};

type AdaptiveThrottleConfig = {
	enabled: boolean;
	latencyThresholdMs: number;
	baseDelayMs: number;
	maxDelayMs: number;
	errorPenalty: number;
	dbSlowQueryThresholdMs: number;
	dbSlowCooldownMs: number;
};

const throttleConfig: AdaptiveThrottleConfig = {
	enabled: config.queueAdaptiveThrottle?.enabled ?? true,
	latencyThresholdMs: config.queueAdaptiveThrottle?.latencyThresholdMs ?? 1500,
	baseDelayMs: config.queueAdaptiveThrottle?.baseDelayMs ?? 250,
	maxDelayMs: config.queueAdaptiveThrottle?.maxDelayMs ?? 5000,
	errorPenalty: 2,
	dbSlowQueryThresholdMs: config.queueAdaptiveThrottle?.dbSlowQueryThresholdMs ?? 1000,
	dbSlowCooldownMs: config.queueAdaptiveThrottle?.dbPollIntervalMs ?? 10000,
};

const states = new Map<string, QueueState>();
let lastDbSlowAt = 0;

const getState = (queueName: string) => {
	let state = states.get(queueName);
	if (state == null) {
		state = {
			latencyEma: 0,
			errorEma: 0,
		};
		states.set(queueName, state);
	}
	return state;
};

const calcQueueDelayMs = (state: QueueState) => {
	const latencyPressure =
		state.latencyEma <= throttleConfig.latencyThresholdMs
			? 0
			: (state.latencyEma - throttleConfig.latencyThresholdMs) /
				throttleConfig.latencyThresholdMs;
	const pressure = latencyPressure + state.errorEma * throttleConfig.errorPenalty;
	return Math.min(
		throttleConfig.maxDelayMs,
		Math.round(throttleConfig.baseDelayMs * pressure),
	);
};

const calcDbDelayMs = () => {
	if (lastDbSlowAt === 0) return 0;
	const elapsed = Date.now() - lastDbSlowAt;
	if (elapsed >= throttleConfig.dbSlowCooldownMs) return 0;
	const rate = 1 - elapsed / throttleConfig.dbSlowCooldownMs;
	return Math.round(throttleConfig.maxDelayMs * rate);
};

/**
 * DB スロークエリを通知し、以降しばらくキュー処理を遅らせる。
 *
 * @param timeMs - クエリにかかった時間（ms）
 * @internal
 */
export function notifyDbSlowQuery(timeMs: number) {
	if (!throttleConfig.enabled) return;
	if (timeMs < throttleConfig.dbSlowQueryThresholdMs) return;
	lastDbSlowAt = Date.now();
}

/**
 * 元プロセッサを Promise 完了まで実行する（コールバックスタイルも吸収する）。
 *
 * @param processor - ラップ対象
 * @param job - Bull ジョブ
 * @returns プロセッサの戻り値（コールバック完了時は `done` の第2引数）
 * @remarks
 * - `length > 1` なら合成 `done` を渡す。
 * - async + `done()` 併用（system ジョブなど）では、先に完了した方で settle し、
 *   二重呼び出しは無視する。
 * @internal
 */
async function invokeProcessor<T>(
	processor: AnyProcessor<T>,
	job: Bull.Job<T>,
): Promise<unknown> {
	// Promise スタイル（deliver / inbox 等）
	if (processor.length <= 1) {
		return await (processor as PromiseProcessor<T>)(job);
	}

	// コールバックスタイル（または async + done 併用）
	return await new Promise<unknown>((resolve, reject) => {
		let settled = false;
		const done: Bull.DoneCallback = (err, value) => {
			if (settled) return;
			settled = true;
			if (err) reject(err);
			else resolve(value);
		};

		try {
			const ret = (
				processor as (
					job: Bull.Job<T>,
					done: Bull.DoneCallback,
				) => void | Promise<unknown>
			)(job, done);

			// async 関数の戻り Promise も完了シグナルにする（done 忘れ・done 前 reject 対策）
			if (ret != null && typeof (ret as Promise<unknown>).then === "function") {
				(ret as Promise<unknown>).then(
					(value) => {
						if (settled) return;
						settled = true;
						resolve(value);
					},
					(err) => {
						if (settled) return;
						settled = true;
						reject(err);
					},
				);
			}
		} catch (err) {
			if (settled) return;
			settled = true;
			reject(err);
		}
	});
}

/**
 * キュープロセッサに適応スロットルを掛ける。
 *
 * @param queueName - 統計を取るキュー名（deliver / system 等）
 * @param processor - 元のジョブ処理関数（Promise / コールバック両対応）
 * @returns Bull 登録用の Promise スタイルプロセッサ
 * @internal
 */
export function adaptiveQueueWrap<T>(
	queueName: string,
	processor: AnyProcessor<T>,
): PromiseProcessor<T> {
	if (!throttleConfig.enabled) {
		// 無効時は元関数をそのまま返す（length > 1 なら Bull が done を渡す）
		return processor as PromiseProcessor<T>;
	}

	return async (job: Bull.Job<T>) => {
		const state = getState(queueName);
		const queueDelay = calcQueueDelayMs(state);
		const delayMs = Math.min(throttleConfig.maxDelayMs, queueDelay + calcDbDelayMs());

		if (delayMs > 0) await sleep(delayMs);

		const startAt = Date.now();
		try {
			const result = await invokeProcessor(processor, job);
			const latency = Date.now() - startAt;
			state.latencyEma =
				state.latencyEma === 0 ? latency : state.latencyEma * 0.8 + latency * 0.2;
			state.errorEma = state.errorEma * 0.8;
			return result;
		} catch (error) {
			const latency = Date.now() - startAt;
			state.latencyEma =
				state.latencyEma === 0 ? latency : state.latencyEma * 0.8 + latency * 0.2;
			state.errorEma = state.errorEma * 0.8 + 0.2;
			throw error;
		}
	};
}
