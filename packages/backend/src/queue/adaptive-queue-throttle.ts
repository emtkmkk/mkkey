import type Bull from "bull";
import config from "@/config/index.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Processor<T> = (job: Bull.Job<T>) => Promise<unknown>;

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

export function notifyDbSlowQuery(timeMs: number) {
	if (!throttleConfig.enabled) return;
	if (timeMs < throttleConfig.dbSlowQueryThresholdMs) return;
	lastDbSlowAt = Date.now();
}

export function adaptiveQueueWrap<T>(queueName: string, processor: Processor<T>): Processor<T> {
	if (!throttleConfig.enabled) return processor;

	return async (job: Bull.Job<T>) => {
		const state = getState(queueName);
		const queueDelay = calcQueueDelayMs(state);
		const delayMs = Math.min(throttleConfig.maxDelayMs, queueDelay + calcDbDelayMs());

		if (delayMs > 0) await sleep(delayMs);

		const startAt = Date.now();
		try {
			const result = await processor(job);
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
