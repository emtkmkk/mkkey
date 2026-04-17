/**
 * @packageDocumentation
 *
 * `composeYouTubeDescription` の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import { composeYouTubeDescription } from "../../src/misc/compose-youtube-description.js";

describe("composeYouTubeDescription", () => {
	it("正常系：video の場合、author_name のみ返す", () => {
		const out = composeYouTubeDescription("Rick Astley", "video", "video");
		assert.strictEqual(out, "Rick Astley");
	});

	it("正常系：shorts の場合、種別と作者名を返す", () => {
		const out = composeYouTubeDescription("Rick Astley", "video", "shorts");
		assert.strictEqual(out, "Shorts: Rick Astley");
	});

	it("正常系：playlist の場合、プレイリスト表記と作者名を返す", () => {
		const out = composeYouTubeDescription("Rick Astley", "playlist", "playlist");
		assert.strictEqual(out, "プレイリスト: Rick Astley");
	});

	it("境界値：author_name が空白のみの場合は null を返す", () => {
		const out = composeYouTubeDescription("   ", "video", "video");
		assert.strictEqual(out, null);
	});
});
