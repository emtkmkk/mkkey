import type Bull from "bull";
import { StatusError } from "@/misc/fetch.js";

type QueueDomain = "deliver" | "inbox";

type DelayedRetryReason = "remote" | "local" | "unknown";

type DelayedRetryState = DelayedRetryReason | "pending";

type DelayedRetryReasonCount = {
	remote: number;
	local: number;
	unknown: number;
	pending: number;
};

type DelayedRetryReasonStats = {
	deliver: DelayedRetryReasonCount;
	inbox: DelayedRetryReasonCount;
};

const domainState = new Map<QueueDomain, Map<string, DelayedRetryState>>([
	["deliver", new Map()],
	["inbox", new Map()],
]);

const stats: DelayedRetryReasonStats = {
	deliver: {
		remote: 0,
		local: 0,
		unknown: 0,
		pending: 0,
	},
	inbox: {
		remote: 0,
		local: 0,
		unknown: 0,
		pending: 0,
	},
};

const remoteErrorCodes = new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"ENOTFOUND",
	"EAI_AGAIN",
	"ETIMEDOUT",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ESOCKETTIMEDOUT",
]);

const remoteErrorNames = new Set(["TimeoutError"]);

const remoteErrorMessagePatterns = [
	"Promise timed out",
	"maximum redirect reached",
	"Bad Gateway",
	"Gateway Time-out",
	"Gateway Timeout",
	"Hostname/IP does not match certificate's altnames",
	"alert handshake failure",
	"EPROTO",
	"socket hang up",
];

const localErrorMessagePatterns = [
	"job stalled more than allowable limit",
	"Acquire mutex",
];

const remoteHttpStatusPattern = /\b5\d\d\b/;

function classifyDelayedRetryReason(error: unknown): DelayedRetryReason {
	if (error instanceof StatusError) {
		return error.isRetryable ? "remote" : "local";
	}

	if (typeof error === "object" && error != null) {
		const anyError = error as { code?: unknown; name?: unknown };
		if (
			typeof anyError.code === "string" &&
			remoteErrorCodes.has(anyError.code)
		) {
			return "remote";
		}

		if (
			typeof anyError.name === "string" &&
			remoteErrorNames.has(anyError.name)
		) {
			return "remote";
		}

		if (
			typeof anyError.name === "string" &&
			["TypeError", "SyntaxError", "ReferenceError", "RangeError"].includes(
				anyError.name,
			)
		) {
			return "local";
		}
	}

	return "unknown";
}

function classifyDelayedRetryReasonByMessage(
	message: string | null | undefined,
): DelayedRetryReason | null {
	if (!message) return null;

	for (const code of remoteErrorCodes) {
		if (message.includes(code)) return "remote";
	}

	for (const pattern of remoteErrorMessagePatterns) {
		if (message.includes(pattern)) return "remote";
	}

	if (remoteHttpStatusPattern.test(message)) {
		return "remote";
	}

	if (
		["TypeError", "SyntaxError", "ReferenceError", "RangeError"].some((name) =>
			message.includes(name),
		)
	) {
		return "local";
	}

	for (const pattern of localErrorMessagePatterns) {
		if (message.includes(pattern)) return "local";
	}

	if (message.length > 0) {
		return "unknown";
	}

	return null;
}

function getMaxAttempts(job: Bull.Job): number {
	const attempts = job.opts?.attempts;
	if (typeof attempts !== "number") return 1;
	return attempts;
}

function toJobId(jobId: Bull.JobId): string {
	return String(jobId);
}

function setState(domain: QueueDomain, jobId: Bull.JobId, nextState: DelayedRetryState): void {
	const state = domainState.get(domain);
	if (!state) return;

	const key = toJobId(jobId);
	const prevState = state.get(key);
	if (prevState === nextState) return;

	if (prevState) {
		stats[domain][prevState] = Math.max(0, stats[domain][prevState] - 1);
	}

	state.set(key, nextState);
	stats[domain][nextState]++;
}

function tryClassifyByJob(job: Bull.Job): DelayedRetryReason | null {
	const failedReason =
		typeof job.failedReason === "string" ? job.failedReason : null;
	const byReason = classifyDelayedRetryReasonByMessage(failedReason);
	if (byReason) return byReason;

	const stacktraceText = Array.isArray(job.stacktrace)
		? job.stacktrace.join("\n")
		: null;
	return classifyDelayedRetryReasonByMessage(stacktraceText);
}

export function markDelayedRetry(
	domain: QueueDomain,
	job: Bull.Job,
	error: unknown,
): void {
	const maxAttempts = getMaxAttempts(job);
	const currentAttempts = job.attemptsMade;
	if (currentAttempts >= maxAttempts) {
		clearDelayedRetry(domain, job.id);
		return;
	}

	setState(domain, job.id, classifyDelayedRetryReason(error));
}

export function clearDelayedRetry(domain: QueueDomain, jobId: Bull.JobId): void {
	const state = domainState.get(domain);
	if (!state) return;

	const key = toJobId(jobId);
	const currentState = state.get(key);
	if (!currentState) return;

	state.delete(key);
	stats[domain][currentState] = Math.max(0, stats[domain][currentState] - 1);
}

export function syncDelayedRetryStateFromJobs(
	domain: QueueDomain,
	delayedJobs: Bull.Job[],
): void {
	const state = domainState.get(domain);
	if (!state) return;

	const delayedJobIds = new Set<string>();
	for (const job of delayedJobs) {
		delayedJobIds.add(toJobId(job.id));
		const classifiedReason = tryClassifyByJob(job);
		if (classifiedReason) {
			setState(domain, job.id, classifiedReason);
		} else {
			setState(domain, job.id, "pending");
		}
	}

	for (const [jobId] of state) {
		if (!delayedJobIds.has(jobId)) {
			clearDelayedRetry(domain, jobId);
		}
	}
}

export function getDelayedRetryReasonStats(): DelayedRetryReasonStats {
	return {
		deliver: {
			remote: stats.deliver.remote,
			local: stats.deliver.local,
			unknown: stats.deliver.unknown,
			pending: stats.deliver.pending,
		},
		inbox: {
			remote: stats.inbox.remote,
			local: stats.inbox.local,
			unknown: stats.inbox.unknown,
			pending: stats.inbox.pending,
		},
	};
}

export function getDelayedRetryPendingCounts(): Record<QueueDomain, number> {
	return {
		deliver: stats.deliver.pending,
		inbox: stats.inbox.pending,
	};
}
