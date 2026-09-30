/**
 * @packageDocumentation
 *
 * `route-title`（もこきーの画面の URL から画面名を引く）の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import { matchRoutePattern, resolveRouteTitle, type RouteTitleTable } from "../../src/misc/route-title.js";

/** テスト用の画面名の表 */
const table: RouteTitleTable = {
	entries: [
		{ path: "/notes/:noteId", title: null, parents: [], keep: true },
		{ path: "/my/lists/:listId", title: null, parents: [] },
		{ path: "/settings", title: "設定", parents: [] },
		{ path: "/settings/timeline", title: "タイムライン", parents: ["設定"] },
		{ path: "/tags/:tag", title: "#{tag}", parents: [] },
		{ path: "/reset-password/:token?", title: "パスワードをリセット", parents: [] },
		{ path: "/registry/keys/system/:path(*)?", title: "レジストリ", parents: [] },
		{ path: "/emoji_dialog/:emoji", title: null, parents: [], kind: "emoji" },
	],
	settingLabels: { reactedRenoteHidden: "リアクションしたリノートを隠す" },
};

describe("route-title", () => {
	describe("matchRoutePattern", () => {
		it("正常系：決まった区切りだけの形は、同じパスに合う", () => {
			assert.deepStrictEqual(matchRoutePattern("/settings/timeline", "/settings/timeline"), new Map());
		});

		it("正常系：パラメータを取り出す（URL のエスケープも戻す）", () => {
			assert.deepStrictEqual(matchRoutePattern("/tags/:tag", "/tags/%E3%82%82%E3%81%93"), new Map([["tag", "もこ"]]));
		});

		it("正常系：省略可のパラメータは、無くても合う", () => {
			assert.deepStrictEqual(matchRoutePattern("/reset-password/:token?", "/reset-password"), new Map());
		});

		it("正常系：(*) はそれ以降すべてを取り出す", () => {
			assert.deepStrictEqual(
				matchRoutePattern("/registry/keys/system/:path(*)?", "/registry/keys/system/a/b"),
				new Map([["path", "a/b"]]),
			);
		});

		it("異常系：区切りが多い URL は合わない", () => {
			assert.strictEqual(matchRoutePattern("/settings", "/settings/timeline"), null);
		});

		it("異常系：必須のパラメータが無いと合わない", () => {
			assert.strictEqual(matchRoutePattern("/tags/:tag", "/tags"), null);
		});
	});

	describe("resolveRouteTitle", () => {
		it("正常系：親の画面名をつなぐ", () => {
			assert.deepStrictEqual(resolveRouteTitle(table, "/settings/timeline"), { kind: "page", label: "設定 > タイムライン" });
		});

		it("正常系：?setting= があれば設定項目の名前もつなぐ", () => {
			assert.deepStrictEqual(resolveRouteTitle(table, "/settings/timeline", "?setting=reactedRenoteHidden"), {
				kind: "page",
				label: "設定 > タイムライン > リアクションしたリノートを隠す",
			});
		});

		it("正常系：画面名の {param} を置き換える", () => {
			assert.deepStrictEqual(resolveRouteTitle(table, "/tags/mkkey"), { kind: "page", label: "#mkkey" });
		});

		it("正常系：絵文字の情報の画面は絵文字の名前を返す", () => {
			assert.deepStrictEqual(resolveRouteTitle(table, "/emoji_dialog/yorosiku"), { kind: "emoji", emoji: "yorosiku" });
		});

		it("境界値：末尾の / があっても同じ画面になる", () => {
			assert.deepStrictEqual(resolveRouteTitle(table, "/settings/"), { kind: "page", label: "設定" });
		});

		it("異常系：知らない設定項目のキーは付けない", () => {
			assert.deepStrictEqual(resolveRouteTitle(table, "/settings/timeline", "setting=unknownKey"), {
				kind: "page",
				label: "設定 > タイムライン",
			});
		});

		it("異常系：最初に合ったのが keep の画面なら null（今までどおりの表示）", () => {
			assert.strictEqual(resolveRouteTitle(table, "/notes/abc"), null);
		});

		it("異常系：最初に合ったのが名前の無い画面なら null", () => {
			assert.strictEqual(resolveRouteTitle(table, "/my/lists/xyz"), null);
		});

		it("異常系：表に無い URL は null", () => {
			assert.strictEqual(resolveRouteTitle(table, "/unknown/path"), null);
		});
	});
});
