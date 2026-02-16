import type Bull from "bull";
import { StatusError } from "@/misc/fetch.js";

type QueueDomain = "deliver" | "inbox";

type DelayedRetryReason = "remote" | "local" | "unknown";

type DelayedRetryReasonCount = {
	remote: number;
	local: number;
	unknown: number;
};

type DelayedRetryReasonStats = {
	deliver: DelayedRetryReasonCount;
	inbox: DelayedRetryReasonCount;
};

const domainState = new Map<QueueDomain, Map<string, DelayedRetryReason>>([
	["deliver", new Map()],
	["inbox", new Map()],
]);

const stats: DelayedRetryReasonStats = {
	deliver: {
		remote: 0,
		local: 0,
		unknown: 0,
	},
	inbox: {
		remote: 0,
		local: 0,
		unknown: 0,
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
			["TypeError", "SyntaxError", "ReferenceError", "RangeError"].includes(
				anyError.name,
			)
		) {
			return "local";
		}
	}

	return "unknown";
}

function getMaxAttempts(job: Bull.Job): number {
	const attempts = job.opts?.attempts;
	if (typeof attempts !== "number") return 1;
	return attempts;
}

function toJobId(jobId: Bull.JobId): string {
	return String(jobId);
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

	const reason = classifyDelayedRetryReason(error);
	const state = domainState.get(domain);
	if (!state) return;

	const key = toJobId(job.id);
	const prevReason = state.get(key);
	if (prevReason === reason) return;

	if (prevReason) {
		stats[domain][prevReason] = Math.max(0, stats[domain][prevReason] - 1);
	}

	state.set(key, reason);
	stats[domain][reason]++;
}

export function clearDelayedRetry(domain: QueueDomain, jobId: Bull.JobId): void {
	const state = domainState.get(domain);
	if (!state) return;

	const key = toJobId(jobId);
	const reason = state.get(key);
	if (!reason) return;

	state.delete(key);
	stats[domain][reason] = Math.max(0, stats[domain][reason] - 1);
}

export function getDelayedRetryReasonStats(): DelayedRetryReasonStats {
	return {
		deliver: {
			remote: stats.deliver.remote,
			local: stats.deliver.local,
			unknown: stats.deliver.unknown,
		},
		inbox: {
			remote: stats.inbox.remote,
			local: stats.inbox.local,
			unknown: stats.inbox.unknown,
		},
	};
}
