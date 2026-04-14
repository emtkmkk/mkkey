/**
 * @packageDocumentation
 *
 * `url-preview-negative-ttl`（Retry-After 解析・ネガティブ TTL）の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	parseRetryAfterSeconds,
	resolveNegativeCacheTtlSecFromOpts,
} from "../../src/misc/url-preview-negative-ttl.js";

describe("url-preview-negative-ttl / parseRetryAfterSeconds", () => {
	it("正常系：秒数の整数文字列をそのまま解釈する", () => {
		assert.strictEqual(parseRetryAfterSeconds("60"), 60);
		assert.strictEqual(parseRetryAfterSeconds("0"), 0);
	});

	it("境界値：前後の空白を除去して解釈する", () => {
		assert.strictEqual(parseRetryAfterSeconds("  120  "), 120);
	});

	it("境界値：数値と一致しない文字列は HTTP-date として解釈を試みる", () => {
		const future = new Date(Date.now() + 90_000).toUTCString();
		const sec = parseRetryAfterSeconds(future);
		assert.ok(sec != null && sec >= 89 && sec <= 91);
	});

	it("異常系：空・解釈不能は null", () => {
		assert.strictEqual(parseRetryAfterSeconds(""), null);
		assert.strictEqual(parseRetryAfterSeconds(null), null);
		assert.strictEqual(parseRetryAfterSeconds(undefined), null);
		assert.strictEqual(parseRetryAfterSeconds("not-a-number"), null);
	});

	it("境界値：負の整数は null（無効）", () => {
		assert.strictEqual(parseRetryAfterSeconds("-5"), null);
	});
});

const testNegOpts = {
	negativeDefaultSec: 120,
	negativeMinSec: 30,
	negativeMaxSec: 3600,
	negative5xxSec: 90,
} as const;

describe("url-preview-negative-ttl / resolveNegativeCacheTtlSecFromOpts", () => {
	it("正常系：429 で Retry-After が無い場合、既定 TTL が min〜max に収まる", () => {
		const ttl = resolveNegativeCacheTtlSecFromOpts(testNegOpts, {
			name: "StatusError",
			message: "rate limited",
			statusCode: 429,
		});
		assert.strictEqual(ttl, 120);
	});

	it("正常系：5xx は 5xx 用既定（クランプ）に寄る", () => {
		const ttl = resolveNegativeCacheTtlSecFromOpts(testNegOpts, {
			name: "StatusError",
			message: "server error",
			statusCode: 503,
		});
		assert.strictEqual(ttl, 90);
	});

	it("正常系：429 かつ response.headers.get で Retry-After が取れる場合、その秒数をクランプする", () => {
		const err = {
			response: {
				headers: {
					get: (n: string) => (n.toLowerCase() === "retry-after" ? "45" : null),
				},
			},
			statusCode: 429,
		};
		const ttl = resolveNegativeCacheTtlSecFromOpts(testNegOpts, err);
		assert.strictEqual(ttl, 45);
	});
});
