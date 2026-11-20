/**
 * @packageDocumentation
 *
 * 遅延リトライ理由の分類（delayed-retry-reason）のテスト。
 *
 * @remarks
 * 画面に出る R/L/U は、master プロセスが遅延ジョブの失敗メッセージから付け直した分類なので、
 * {@link syncDelayedRetryStateFromJobs} にジョブの形だけを渡して確かめる。
 * DB・Redis の接続先は `.config/test.yml`（database:5432 / redis:6379）を使う。
 *
 * @internal
 */
import * as assert from "assert";
import type Bull from "bull";
import {
	getDelayedRetryReasonStats,
	syncDelayedRetryStateFromJobs,
} from "../../src/queue/delayed-retry-reason.js";

/** 失敗メッセージとスタックだけを持つジョブを作る。 */
function job(id: string, failedReason: string, stack?: string): Bull.Job {
	return {
		id,
		failedReason,
		stacktrace: stack ? [stack] : [],
	} as unknown as Bull.Job;
}

/** 1 件だけ同期して、どの分類になったかを返す。 */
function classify(failedReason: string, stack?: string): string {
	syncDelayedRetryStateFromJobs("inbox", [job("1", failedReason, stack)]);
	const s = getDelayedRetryReasonStats().inbox;
	const hit = (["remote", "local", "unknown", "pending"] as const).filter(
		(k) => s[k] === 1,
	);
	return hit.join(",");
}

describe("delayed-retry-reason", () => {
	afterEach(() => {
		// 空で同期して状態を消す
		syncDelayedRetryStateFromJobs("inbox", []);
	});

	describe("syncDelayedRetryStateFromJobs", () => {
		it("正常系：相手先への接続失敗の場合、remote になる", () => {
			assert.strictEqual(
				classify("request to https://a.example/inbox failed, reason: connect EHOSTUNREACH 203.0.113.1:443"),
				"remote",
			);
		});

		it("正常系：自分の DB への接続失敗の場合、コードが同じでも local になる", () => {
			assert.strictEqual(classify("connect EHOSTUNREACH database:5432"), "local");
			assert.strictEqual(classify("connect ECONNREFUSED database:5432"), "local");
		});

		it("正常系：自分の Redis への接続失敗の場合、local になる", () => {
			assert.strictEqual(classify("connect ECONNREFUSED redis:6379"), "local");
		});

		it("正常系：DNS サーバの失敗（ESERVFAIL）の場合、remote になる", () => {
			assert.strictEqual(
				classify("request to https://baraag.net/inbox failed, reason: queryA ESERVFAIL baraag.net"),
				"remote",
			);
		});

		it("正常系：メッセージで分からなくても、スタックにエラー名があれば使う", () => {
			assert.strictEqual(
				classify("server shutting down", "QueryFailedError: server shutting down\n    at ..."),
				"local",
			);
		});

		it("境界値：メッセージもスタックも分からない場合、unknown になる", () => {
			assert.strictEqual(classify("something odd", "Error: something odd\n    at ..."), "unknown");
		});

		it("異常系：メッセージもスタックも無い場合、pending になる", () => {
			assert.strictEqual(classify(""), "pending");
		});
	});
});
