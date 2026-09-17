/**
 * @packageDocumentation
 *
 * `isIgnoredMention` の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import { isIgnoredMention } from "../../src/misc/is-ignored-mention.js";

const localHost = "example.com";

describe("isIgnoredMention", () => {
	it("正常系：ホスト未指定の @youtube は無視する", () => {
		assert.strictEqual(isIgnoredMention("youtube", null, localHost), true);
	});

	it("正常系：自ホストを明示した @youtube も無視する", () => {
		assert.strictEqual(
			isIgnoredMention("youtube", localHost, localHost),
			true,
		);
	});

	it("正常系：リモートの @youtube は無視しない", () => {
		assert.strictEqual(
			isIgnoredMention("youtube", "remote.example.com", localHost),
			false,
		);
	});

	it("正常系：他のユーザー名は無視しない", () => {
		assert.strictEqual(isIgnoredMention("alice", null, localHost), false);
	});

	it("境界値：大文字小文字は区別しない", () => {
		assert.strictEqual(
			isIgnoredMention("YouTube", "EXAMPLE.COM", localHost),
			true,
		);
	});

	it("境界値：前方一致する名前は無視しない", () => {
		assert.strictEqual(isIgnoredMention("youtuber", null, localHost), false);
	});
});
