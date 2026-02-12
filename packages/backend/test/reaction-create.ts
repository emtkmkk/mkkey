process.env.NODE_ENV = "test";

import * as assert from "assert";
import {
	evaluateReactionLimit,
	normalizeReactionMuteResult,
} from "../src/services/note/reaction/create.js";

describe("Reaction create service helper", () => {
	describe("normalizeReactionMuteResult", () => {
		it("booleanのmute結果を拒否設定付きで正規化できる", () => {
			const result = normalizeReactionMuteResult(true, true);

			assert.deepStrictEqual(result, {
				isMutedReaction: true,
				shouldReject: true,
			});
		});

		it("reject指定がないobjectはdefaultRejectを利用する", () => {
			const result = normalizeReactionMuteResult({ muted: true }, false);

			assert.deepStrictEqual(result, {
				isMutedReaction: true,
				shouldReject: false,
			});
		});

		it("reject指定があるobjectはdefaultRejectより優先される", () => {
			const result = normalizeReactionMuteResult(
				{ muted: true, reject: false },
				true,
			);

			assert.deepStrictEqual(result, {
				isMutedReaction: true,
				shouldReject: false,
			});
		});
	});

	describe("evaluateReactionLimit", () => {
		it("既存数が上限未満なら許可される", () => {
			const result = evaluateReactionLimit({
				existCount: 0,
				maxReactions: 1,
				reaction: "like",
			});

			assert.strictEqual(result, "allow");
		});

		it("上限1件で同一リアクションの場合はduplicate_error", () => {
			const result = evaluateReactionLimit({
				existCount: 1,
				maxReactions: 1,
				reaction: "like",
				existingReaction: "like",
			});

			assert.strictEqual(result, "duplicate_error");
		});

		it("上限1件で別リアクションの場合はreplace", () => {
			const result = evaluateReactionLimit({
				existCount: 1,
				maxReactions: 1,
				reaction: "like",
				existingReaction: "love",
			});

			assert.strictEqual(result, "replace");
		});

		it("上限複数件を超えた場合はlimit_error", () => {
			const result = evaluateReactionLimit({
				existCount: 2,
				maxReactions: 2,
				reaction: "like",
				existingReaction: "love",
			});

			assert.strictEqual(result, "limit_error");
		});
	});
});
