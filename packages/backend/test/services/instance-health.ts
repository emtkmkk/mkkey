/**
 * @packageDocumentation
 *
 * 配送結果の分類（classify）と、配送先サーバごとのサーキットブレーカー（circuit）のテスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	classifyDeliverError,
	isProbeAlive,
	toHostDownAfterConnectCheck,
	type DeliverOutcome,
} from "../../src/services/instance-health/classify.js";
import { HostCircuitBreaker } from "../../src/services/instance-health/circuit.js";

/** `StatusError` と同じ形の例外を作る（本物は config に依存するので import しない）。 */
function statusError(statusCode: number, retryAfter?: string) {
	return Object.assign(new Error(`${statusCode}`), {
		name: "StatusError",
		statusCode,
		retryAfter,
	});
}

/** `redirect: "manual"` のときの 3xx の `StatusError` と同じ形の例外を作る。 */
function redirectError(statusCode: number, location: string, otherSite: boolean) {
	return Object.assign(statusError(statusCode), {
		location,
		redirectedToOtherSite: otherSite,
	});
}

/** node-fetch の `FetchError`（system エラー）と同じ形の例外を作る。 */
function fetchError(code: string, erroredSysCall?: string) {
	return Object.assign(new Error(`request failed, reason: ${code}`), {
		name: "FetchError",
		type: "system",
		code,
		erroredSysCall,
	});
}

/** 名前だけを持つ例外を作る。 */
function namedError(name: string) {
	return Object.assign(new Error(name), { name });
}

const shared = { isSharedInbox: true };
const personal = { isSharedInbox: false };

const down: DeliverOutcome = { kind: "hostDown", label: "ECONNREFUSED" };
const ok: DeliverOutcome = { kind: "success", label: "2xx" };

describe("instance-health", () => {
	describe("classifyDeliverError", () => {
		it("正常系：接続拒否・DNS の失敗の場合、hostDown になる", () => {
			assert.strictEqual(classifyDeliverError(fetchError("ECONNREFUSED", "connect"), personal).kind, "hostDown");
			assert.strictEqual(classifyDeliverError(fetchError("ENOTFOUND", "getaddrinfo"), personal).kind, "hostDown");
			assert.strictEqual(classifyDeliverError(fetchError("EAI_AGAIN"), personal).kind, "hostDown");
			// DNS サーバの失敗（本番の baraag.net）と、DNS キャッシュ経由の失敗
			assert.strictEqual(classifyDeliverError(fetchError("ESERVFAIL", "queryA"), personal).kind, "hostDown");
			assert.strictEqual(classifyDeliverError(fetchError("ENOTFOUND", "cacheableLookup"), personal).kind, "hostDown");
			assert.strictEqual(classifyDeliverError(fetchError("ENODATA", "cacheableLookup"), personal).kind, "hostDown");
		});

		it("正常系：TLS のハンドシェイク・証明書の失敗の場合、hostDown になる", () => {
			assert.strictEqual(classifyDeliverError(fetchError("EPROTO", "write"), personal).kind, "hostDown");
			assert.strictEqual(classifyDeliverError(fetchError("CERT_HAS_EXPIRED"), personal).kind, "hostDown");
			assert.strictEqual(classifyDeliverError(fetchError("ERR_TLS_CERT_ALTNAME_INVALID"), personal).kind, "hostDown");
		});

		it("正常系：connect のシステムコールでのタイムアウトの場合、hostDown になる", () => {
			const r = classifyDeliverError(fetchError("ETIMEDOUT", "connect"), personal);
			assert.strictEqual(r.kind, "hostDown");
			assert.strictEqual(r.label, "ETIMEDOUT(connect)");
		});

		it("正常系：前段のゲートウェイのエラー（502/503/504/521/522/523/530）の場合、hostDown になる", () => {
			for (const s of [502, 503, 504, 521, 522, 523, 525, 526, 530]) {
				assert.strictEqual(classifyDeliverError(statusError(s), personal).kind, "hostDown", `status ${s}`);
			}
		});

		it("正常系：500・520・524 の場合、内容が原因のこともあるので ambiguous になる", () => {
			for (const s of [500, 501, 520, 524]) {
				assert.strictEqual(classifyDeliverError(statusError(s), personal).kind, "ambiguous", `status ${s}`);
			}
		});

		it("正常系：応答待ちのタイムアウトの場合、ambiguous で接続確認が必要になる", () => {
			const abort = classifyDeliverError(namedError("AbortError"), personal);
			assert.strictEqual(abort.kind, "ambiguous");
			assert.strictEqual(abort.needsConnectCheck, true);

			const socket = classifyDeliverError(fetchError("ETIMEDOUT", "read"), personal);
			assert.strictEqual(socket.kind, "ambiguous");
			assert.strictEqual(socket.needsConnectCheck, true);
		});

		it("正常系：送信中の切断（ECONNRESET）の場合、ambiguous で接続確認は不要", () => {
			const r = classifyDeliverError(fetchError("ECONNRESET", "read"), personal);
			assert.strictEqual(r.kind, "ambiguous");
			assert.strictEqual(r.needsConnectCheck, undefined);
		});

		it("正常系：4xx の場合、recipientError になる", () => {
			for (const s of [400, 401, 403, 404, 405, 413]) {
				assert.strictEqual(classifyDeliverError(statusError(s), personal).kind, "recipientError", `status ${s}`);
			}
		});

		it("正常系：410 は shared inbox なら gone、個人の inbox なら recipientError になる", () => {
			assert.strictEqual(classifyDeliverError(statusError(410), shared).kind, "gone");
			assert.strictEqual(classifyDeliverError(statusError(410), personal).kind, "recipientError");
		});

		it("正常系：429 の場合、rateLimited で Retry-After をミリ秒で返す", () => {
			const r = classifyDeliverError(statusError(429, "120"), personal);
			assert.strictEqual(r.kind, "rateLimited");
			assert.strictEqual(r.retryAfterMs, 120_000);
		});

		it("異常系：Retry-After が読めない・0 の場合、retryAfterMs は undefined", () => {
			assert.strictEqual(classifyDeliverError(statusError(429, "abc"), personal).retryAfterMs, undefined);
			assert.strictEqual(classifyDeliverError(statusError(429, "0"), personal).retryAfterMs, undefined);
			assert.strictEqual(classifyDeliverError(statusError(429), personal).retryAfterMs, undefined);
		});

		it("異常系：例外でない値が投げられた場合、ambiguous になる", () => {
			assert.strictEqual(classifyDeliverError("oops", personal).kind, "ambiguous");
			assert.strictEqual(classifyDeliverError(null, personal).kind, "ambiguous");
		});

		it("正常系：接続確認に失敗した場合、hostDown に直る", () => {
			const r = toHostDownAfterConnectCheck(classifyDeliverError(namedError("AbortError"), personal));
			assert.strictEqual(r.kind, "hostDown");
			assert.strictEqual(r.label, "timeout+connect-failed");
		});
	});

	describe("classifyDeliverError（転送）", () => {
		it("正常系：別のサイトへの転送の場合、hostDown になり転送先のホストを残す", () => {
			const r = classifyDeliverError(
				redirectError(301, "https://expireddomains.com/domain/oran.ski", true),
				personal,
			);
			assert.strictEqual(r.kind, "hostDown");
			assert.strictEqual(r.label, "redirect to expireddomains.com");
			assert.strictEqual(r.statusCode, 301);
		});

		it("正常系：同じサイト内の転送の場合、recipientError になる", () => {
			const r = classifyDeliverError(
				redirectError(308, "https://layp.net/", false),
				shared,
			);
			assert.strictEqual(r.kind, "recipientError");
			assert.strictEqual(r.label, "308");
		});

		it("境界値：転送先が読めない別サイトの場合も hostDown になる", () => {
			const r = classifyDeliverError(redirectError(302, "::bad::", true), personal);
			assert.strictEqual(r.kind, "hostDown");
			assert.strictEqual(r.label, "redirect to ?");
		});
	});

	describe("isProbeAlive", () => {
		it("正常系：別のサイトへの転送の場合、生きていないとみなす", () => {
			assert.strictEqual(
				isProbeAlive(redirectError(301, "https://expireddomains.com/", true)),
				false,
			);
		});

		it("正常系：同じサイト内の転送の場合、生きているとみなす", () => {
			assert.strictEqual(
				isProbeAlive(redirectError(301, "https://www.example.com/.well-known/nodeinfo", false)),
				true,
			);
		});

		it("正常系：成功・4xx・500 の場合、生きているとみなす", () => {
			assert.strictEqual(isProbeAlive(null), true);
			assert.strictEqual(isProbeAlive(statusError(404)), true);
			assert.strictEqual(isProbeAlive(statusError(500)), true);
		});

		it("異常系：接続の失敗・ゲートウェイのエラー・タイムアウトの場合、生きていないとみなす", () => {
			assert.strictEqual(isProbeAlive(fetchError("ECONNREFUSED", "connect")), false);
			assert.strictEqual(isProbeAlive(statusError(521)), false);
			assert.strictEqual(isProbeAlive(namedError("AbortError")), false);
			assert.strictEqual(isProbeAlive(fetchError("ECONNRESET", "read")), false);
		});
	});

	describe("HostCircuitBreaker", () => {
		let now = 0;
		const make = () =>
			new HostCircuitBreaker({
				threshold: 3,
				baseCooldownMs: 1000,
				maxCooldownMs: 4000,
				maxRateLimitMs: 10_000,
				now: () => now,
			});

		beforeEach(() => {
			now = 1_000_000;
		});

		it("正常系：状態が無いホストの場合、send を返す", () => {
			assert.deepStrictEqual(make().check("a.example"), { action: "send" });
		});

		it("正常系：異なるジョブで閾値まで失敗した場合、不調になり skip を返す", () => {
			const cb = make();
			assert.strictEqual(cb.recordResult("a.example", "1", down), null);
			assert.strictEqual(cb.recordResult("a.example", "2", down), null);
			const event = cb.recordResult("a.example", "3", down);
			assert.strictEqual(event?.type, "opened");
			assert.strictEqual(event?.type === "opened" && event.failures, 3);

			const d = cb.check("a.example");
			assert.strictEqual(d.action, "skip");
			assert.strictEqual(d.action === "skip" && d.startProbe, false);
			assert.strictEqual(cb.wouldSkip("a.example"), true);
		});

		it("境界値：同じジョブの再送は 1 件として数えるので、不調にならない", () => {
			const cb = make();
			for (let i = 0; i < 10; i++) {
				assert.strictEqual(cb.recordResult("a.example", "same", down), null);
			}
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
		});

		it("正常系：間に成功があると数え直す", () => {
			const cb = make();
			cb.recordResult("a.example", "1", down);
			cb.recordResult("a.example", "2", down);
			cb.recordResult("a.example", "3", ok);
			cb.recordResult("a.example", "4", down);
			cb.recordResult("a.example", "5", down);
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
		});

		it("正常系：間に 4xx（相手のアプリが応答した）があると数え直す", () => {
			const cb = make();
			cb.recordResult("a.example", "1", down);
			cb.recordResult("a.example", "2", down);
			cb.recordResult("a.example", "3", { kind: "recipientError", label: "404", statusCode: 404 });
			cb.recordResult("a.example", "4", down);
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
		});

		it("正常系：あいまいな失敗は数えず、数え直しもしない", () => {
			const cb = make();
			cb.recordResult("a.example", "1", down);
			cb.recordResult("a.example", "2", down);
			cb.recordResult("a.example", "3", { kind: "ambiguous", label: "500", statusCode: 500 });
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
			assert.strictEqual(cb.recordResult("a.example", "4", down)?.type, "opened");
		});

		it("正常系：ホストごとに独立して数える", () => {
			const cb = make();
			cb.recordResult("a.example", "1", down);
			cb.recordResult("b.example", "2", down);
			cb.recordResult("a.example", "3", down);
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
			assert.deepStrictEqual(cb.check("b.example"), { action: "send" });
		});

		it("正常系：待ち時間が過ぎたら、確認は 1 本だけ始めてもらう", () => {
			const cb = make();
			for (const id of ["1", "2", "3"]) cb.recordResult("a.example", id, down);

			now += 1000;
			const first = cb.check("a.example");
			const second = cb.check("a.example");
			assert.strictEqual(first.action === "skip" && first.startProbe, true);
			assert.strictEqual(second.action === "skip" && second.startProbe, false);
		});

		it("正常系：確認が成功したら健康に戻る", () => {
			const cb = make();
			for (const id of ["1", "2", "3"]) cb.recordResult("a.example", id, down);
			now += 1500;
			cb.check("a.example");

			const event = cb.recordProbeResult("a.example", true);
			assert.strictEqual(event?.type, "closed");
			assert.strictEqual(event?.type === "closed" && event.by, "probe");
			assert.strictEqual(event?.type === "closed" && event.openForMs, 1500);
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
			assert.deepStrictEqual(cb.snapshot(), []);
		});

		it("正常系：確認が失敗したら待ち時間を倍にする", () => {
			const cb = make();
			for (const id of ["1", "2", "3"]) cb.recordResult("a.example", id, down);
			now += 1000;
			cb.check("a.example");

			assert.strictEqual(cb.recordProbeResult("a.example", false, "521"), null);
			const [snap] = cb.snapshot();
			assert.strictEqual(snap.cooldownMs, 2000);
			assert.strictEqual(snap.nextProbeAt, now + 2000);
			assert.strictEqual(snap.lastError, "521");

			// 次の待ち時間が過ぎるまでは確認を始めない
			now += 1999;
			const d = cb.check("a.example");
			assert.strictEqual(d.action === "skip" && d.startProbe, false);
		});

		it("境界値：待ち時間は上限を超えない", () => {
			const cb = make();
			for (const id of ["1", "2", "3"]) cb.recordResult("a.example", id, down);
			for (let i = 0; i < 5; i++) {
				now += 10_000;
				cb.check("a.example");
				cb.recordProbeResult("a.example", false);
			}
			assert.strictEqual(cb.snapshot()[0].cooldownMs, 4000);
		});

		it("正常系：不調の間に、先に出ていた配送が成功したら健康に戻る", () => {
			const cb = make();
			for (const id of ["1", "2", "3"]) cb.recordResult("a.example", id, down);
			const event = cb.recordResult("a.example", "4", ok);
			assert.strictEqual(event?.type === "closed" && event.by, "delivery");
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
		});

		it("正常系：429 の場合、数えないが Retry-After の間は skip を返す", () => {
			const cb = make();
			cb.recordResult("a.example", "1", { kind: "rateLimited", label: "429", statusCode: 429, retryAfterMs: 5000 });
			const d = cb.check("a.example");
			assert.strictEqual(d.action === "skip" && d.reason, "rateLimited");

			now += 5000;
			assert.deepStrictEqual(cb.check("a.example"), { action: "send" });
		});

		it("境界値：429 の待ちは上限を超えない", () => {
			const cb = make();
			cb.recordResult("a.example", "1", { kind: "rateLimited", label: "429", retryAfterMs: 999_999 });
			const d = cb.check("a.example");
			assert.strictEqual(d.action === "skip" && d.until, now + 10_000);
		});

		it("異常系：不調でないホストの確認結果は無視する", () => {
			const cb = make();
			assert.strictEqual(cb.recordProbeResult("a.example", true), null);
			assert.strictEqual(cb.recordProbeResult("a.example", false), null);
		});

		it("境界値：ホスト数の上限を超えたら、不調でないものから消す", () => {
			const cb = new HostCircuitBreaker({ threshold: 1, maxHosts: 2, now: () => now });
			cb.recordResult("open.example", "1", down); // 不調
			cb.recordResult("b.example", "2", { kind: "rateLimited", label: "429", retryAfterMs: 1000 });
			cb.recordResult("c.example", "3", { kind: "rateLimited", label: "429", retryAfterMs: 1000 });

			assert.strictEqual(cb.wouldSkip("open.example"), true);
			assert.strictEqual(cb.wouldSkip("b.example"), false); // 消えた
			assert.strictEqual(cb.wouldSkip("c.example"), true);
		});

		it("正常系：forget の場合、できごとを出さずに健康に戻す（長期の停止の解除用）", () => {
			const cb = new HostCircuitBreaker({ threshold: 1, now: () => now });
			cb.recordResult("a.example", "1", down);
			assert.strictEqual(cb.wouldSkip("a.example"), true);

			cb.forget("a.example");

			assert.strictEqual(cb.wouldSkip("a.example"), false);
			assert.deepStrictEqual(cb.snapshot(), []);
			// 消したあとの確認の結果は無視される
			assert.strictEqual(cb.recordProbeResult("a.example", true), null);
		});
	});
});
