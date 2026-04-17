/**
 * @packageDocumentation
 *
 * `isYouTubeOembedTargetUrl` の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import { isYouTubeOembedTargetUrl } from "../../src/misc/is-youtube-oembed-target-url.js";

describe("isYouTubeOembedTargetUrl", () => {
	it("正常系：watch URL を oEmbed 向け watch に正規化する", () => {
		const out = isYouTubeOembedTargetUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		assert.deepStrictEqual(out, {
			oembedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			kind: "video",
			sitename: "YouTube",
			videoId: "dQw4w9WgXcQ",
		});
	});

	it("正常系：shorts URL は watch へ変換し kind=shorts を返す", () => {
		const out = isYouTubeOembedTargetUrl("https://www.youtube.com/shorts/abcDEF123");
		assert.deepStrictEqual(out, {
			oembedUrl: "https://www.youtube.com/watch?v=abcDEF123",
			kind: "shorts",
			sitename: "YouTube",
			videoId: "abcDEF123",
		});
	});

	it("正常系：playlist URL は list を維持する", () => {
		const out = isYouTubeOembedTargetUrl("https://www.youtube.com/playlist?list=PL1234");
		assert.deepStrictEqual(out, {
			oembedUrl: "https://www.youtube.com/playlist?list=PL1234",
			kind: "playlist",
			sitename: "YouTube",
			videoId: null,
		});
	});

	it("正常系：youtu.be URL は watch へ変換する", () => {
		const out = isYouTubeOembedTargetUrl("https://youtu.be/dQw4w9WgXcQ");
		assert.deepStrictEqual(out, {
			oembedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			kind: "video",
			sitename: "YouTube",
			videoId: "dQw4w9WgXcQ",
		});
	});

	it("正常系：music.youtube.com 起点では sitename=YouTube Music を返す", () => {
		const out = isYouTubeOembedTargetUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
		assert.deepStrictEqual(out, {
			oembedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			kind: "video",
			sitename: "YouTube Music",
			videoId: "dQw4w9WgXcQ",
		});
	});

	it("異常系：channel URL は oEmbed 非対応として null を返す", () => {
		assert.strictEqual(
			isYouTubeOembedTargetUrl("https://www.youtube.com/channel/UCxxxxxxxx"),
			null,
		);
	});

	it("異常系：/about は oEmbed 非対応として null を返す", () => {
		assert.strictEqual(
			isYouTubeOembedTargetUrl("https://www.youtube.com/about"),
			null,
		);
	});

	it("異常系：YouTube 以外の URL は null を返す", () => {
		assert.strictEqual(isYouTubeOembedTargetUrl("https://example.com/watch?v=test"), null);
	});
});
