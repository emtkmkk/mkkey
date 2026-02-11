export const FILE_SELECT_IDLE_WAIT_MS = 80;

export type UploadWaitStateInput = {
	pendingPromiseCount: number;
	activeUploadCount: number;
	now: number;
	noActiveUploadsSince: number | null;
	staleUploadWaitMs: number;
};

export type UploadWaitStateResult = {
	nextNoActiveUploadsSince: number | null;
	shouldForceResetPromises: boolean;
	shouldWaitBeforeRetry: boolean;
};

export function evaluateUploadWaitState({
	pendingPromiseCount,
	activeUploadCount,
	now,
	noActiveUploadsSince,
	staleUploadWaitMs,
}: UploadWaitStateInput): UploadWaitStateResult {
	if (pendingPromiseCount === 0) {
		return {
			nextNoActiveUploadsSince: null,
			shouldForceResetPromises: false,
			shouldWaitBeforeRetry: false,
		};
	}

	if (activeUploadCount > 0) {
		return {
			nextNoActiveUploadsSince: null,
			shouldForceResetPromises: false,
			shouldWaitBeforeRetry: false,
		};
	}

	if (noActiveUploadsSince === null) {
		return {
			nextNoActiveUploadsSince: now,
			shouldForceResetPromises: false,
			shouldWaitBeforeRetry: true,
		};
	}

	if (now - noActiveUploadsSince >= staleUploadWaitMs) {
		return {
			nextNoActiveUploadsSince: noActiveUploadsSince,
			shouldForceResetPromises: true,
			shouldWaitBeforeRetry: false,
		};
	}

	return {
		nextNoActiveUploadsSince: noActiveUploadsSince,
		shouldForceResetPromises: false,
		shouldWaitBeforeRetry: true,
	};
}

export function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
