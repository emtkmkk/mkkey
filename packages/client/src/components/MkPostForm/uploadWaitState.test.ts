import assert from "node:assert/strict";
import test from "node:test";

import { evaluateUploadWaitState } from "./uploadWaitState";

test("pendingPromiseCount が 0 のとき待機を継続しない", () => {
	const state = evaluateUploadWaitState({
		pendingPromiseCount: 0,
		activeUploadCount: 0,
		now: 100,
		noActiveUploadsSince: 10,
		staleUploadWaitMs: 1000,
	});

	assert.equal(state.shouldWaitBeforeRetry, false);
	assert.equal(state.shouldForceResetPromises, false);
	assert.equal(state.nextNoActiveUploadsSince, null);
});

test("upload が進行中なら stale 判定をリセットする", () => {
	const state = evaluateUploadWaitState({
		pendingPromiseCount: 2,
		activeUploadCount: 1,
		now: 100,
		noActiveUploadsSince: 10,
		staleUploadWaitMs: 1000,
	});

	assert.equal(state.shouldWaitBeforeRetry, false);
	assert.equal(state.shouldForceResetPromises, false);
	assert.equal(state.nextNoActiveUploadsSince, null);
});

test("upload が止まった直後は時刻を記録して短時間 wait を返す", () => {
	const state = evaluateUploadWaitState({
		pendingPromiseCount: 2,
		activeUploadCount: 0,
		now: 150,
		noActiveUploadsSince: null,
		staleUploadWaitMs: 1000,
	});

	assert.equal(state.shouldWaitBeforeRetry, true);
	assert.equal(state.shouldForceResetPromises, false);
	assert.equal(state.nextNoActiveUploadsSince, 150);
});

test("staleUploadWaitMs を超過したら promise リセットを返す", () => {
	const state = evaluateUploadWaitState({
		pendingPromiseCount: 2,
		activeUploadCount: 0,
		now: 1201,
		noActiveUploadsSince: 200,
		staleUploadWaitMs: 1000,
	});

	assert.equal(state.shouldWaitBeforeRetry, false);
	assert.equal(state.shouldForceResetPromises, true);
	assert.equal(state.nextNoActiveUploadsSince, 200);
});
