/**
 * @packageDocumentation
 *
 * `normalizeUrlForPreviewFetch` の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import { normalizeUrlForPreviewFetch } from "../../src/misc/normalize-url-for-preview-fetch.js";

describe("normalizeUrlForPreviewFetch", () => {
	it("正常系：music.youtube.com の watch を www.youtube.com に寄せ、ハッシュを除去する", () => {
		const out = normalizeUrlForPreviewFetch(
			"https://music.youtube.com/watch?v=dQw4w9WgXcQ#t=10s",
		);
		assert.strictEqual(
			out,
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
	});

	it("正常系：music.youtube.com の playlist も www に寄せる", () => {
		const out = normalizeUrlForPreviewFetch(
			"https://music.youtube.com/playlist?list=PLtest",
		);
		assert.strictEqual(
			out,
			"https://www.youtube.com/playlist?list=PLtest",
		);
	});

	it("境界値：music.youtube.com の browse はホストを変えない", () => {
		const raw = "https://music.youtube.com/browse/MPREb_abc";
		const out = normalizeUrlForPreviewFetch(raw);
		assert.strictEqual(out, "https://music.youtube.com/browse/MPREb_abc");
	});

	it("境界値：通常の www.youtube.com はホストを変えない", () => {
		const raw = "https://www.youtube.com/watch?v=abc#hash";
		const out = normalizeUrlForPreviewFetch(raw);
		assert.strictEqual(out, "https://www.youtube.com/watch?v=abc");
	});

	it("異常系：パース不能な文字列はそのまま返す", () => {
		const raw = ":::not-a-url";
		assert.strictEqual(normalizeUrlForPreviewFetch(raw), raw);
	});
});
