/**
 * @packageDocumentation
 *
 * 範囲付きミュートのビット変換とリアクション差し引きの単体テスト。
 *
 * @internal
 */

process.env.NODE_ENV = "test";

import * as assert from "assert";
import {
	decodeMuteScope,
	encodeMuteTypes,
	hasMuteScope,
	MUTE_SCOPE_BITS,
} from "../src/misc/mute-scope.js";
import {
	shouldFilterReactionStream,
	subtractHiddenReactionDeltas,
} from "../src/misc/reaction-count.js";

describe("範囲付きミュート", () => {
	describe("範囲ビット変換", () => {
		it("正常系：複数の個別範囲を指定した場合、同じ範囲へ復元できる", () => {
			const scope = encodeMuteTypes(["reaction", "note", "notification"]);

			assert.deepStrictEqual(decodeMuteScope(scope), [
				"note",
				"notification",
				"reaction",
			]);
			assert.strictEqual(hasMuteScope(scope, "reaction"), true);
			assert.strictEqual(hasMuteScope(scope, "renote"), false);
		});

		it("正常系：allを指定した場合、個別範囲をすべて内包する", () => {
			const scope = encodeMuteTypes(["reaction", "all", "push"]);

			assert.strictEqual(scope, MUTE_SCOPE_BITS.all);
			assert.deepStrictEqual(decodeMuteScope(scope), ["all"]);
			assert.strictEqual(hasMuteScope(scope, "message"), true);
			assert.strictEqual(hasMuteScope(scope, "follow"), true);
		});

		it("境界値：空の範囲を指定した場合、0になる", () => {
			assert.strictEqual(encodeMuteTypes([]), 0);
			assert.deepStrictEqual(decodeMuteScope(0), []);
		});
	});

	describe("リアクション差し引き", () => {
		it("正常系：非表示利用者分だけリアクション件数を差し引く", () => {
			const result = subtractHiddenReactionDeltas(
				{ like: 4, love: 2 },
				{ like: 1 },
			);

			assert.deepStrictEqual(result, { like: 3, love: 2 });
		});

		it("境界値：差し引き結果が0以下の場合、リアクション自体を除外する", () => {
			const result = subtractHiddenReactionDeltas(
				{ like: 1, love: 2, zero: 0 },
				{ like: 3, love: 2 },
			);

			assert.deepStrictEqual(result, {});
		});
	});

	describe("リアクションストリーム", () => {
		it("正常系：設定ONでいずれかの関係集合に含まれる場合、イベントを除外する", () => {
			const result = shouldFilterReactionStream(true, "target", [
				new Set(["muted"]),
				new Set(["target"]),
				new Set(),
			]);

			assert.strictEqual(result, true);
		});

		it("正常系：設定OFFの場合、関係集合に含まれていてもイベントを通す", () => {
			const result = shouldFilterReactionStream(false, "target", [
				new Set(["target"]),
			]);

			assert.strictEqual(result, false);
		});

		it("境界値：操作利用者IDがないイベントは除外しない", () => {
			assert.strictEqual(
				shouldFilterReactionStream(true, null, [new Set(["target"])]),
				false,
			);
		});
	});
});
