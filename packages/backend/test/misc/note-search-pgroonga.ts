/**
 * @packageDocumentation
 *
 * 投稿検索の pgroonga 補助（候補語の選び方と、時間切れエラーの判定）のテスト。
 *
 * @internal
 */
import * as assert from "assert";
import { QueryFailedError } from "typeorm";
import {
	isQueryCanceledError,
	pickCandidateWord,
} from "../../src/server/api/common/note-search-pgroonga.js";

/** PostgreSQL のエラーコード付きの QueryFailedError を作る。 */
function queryFailed(code: string): QueryFailedError {
	return new QueryFailedError("SELECT 1", [], Object.assign(new Error("db error"), { code }));
}

describe("note-search-pgroonga", () => {
	describe("pickCandidateWord", () => {
		it("正常系：複数の語がある場合、最も長い語を返す", () => {
			assert.strictEqual(pickCandidateWord(["の", "ぺんぎんさん", "猫"]), "ぺんぎんさん");
		});

		it("正常系：同じ長さの語がある場合、先の語を返す", () => {
			assert.strictEqual(pickCandidateWord(["ねこ", "いぬ"]), "ねこ");
		});

		it("境界値：サロゲートペアの絵文字は 1 文字として数える", () => {
			// "🐧🐧" は UTF-16 では 4 単位だが 2 文字。"ぺんぎ" の 3 文字の方が長い
			assert.strictEqual(pickCandidateWord(["🐧🐧", "ぺんぎ"]), "ぺんぎ");
		});

		it("境界値：語が無い場合、null を返す", () => {
			assert.strictEqual(pickCandidateWord([]), null);
		});
	});

	describe("isQueryCanceledError", () => {
		it("正常系：statement_timeout による打ち切り（57014）の場合、true を返す", () => {
			assert.strictEqual(isQueryCanceledError(queryFailed("57014")), true);
		});

		it("異常系：別の DB エラーの場合、false を返す", () => {
			assert.strictEqual(isQueryCanceledError(queryFailed("23505")), false);
		});

		it("異常系：DB 以外のエラーの場合、false を返す", () => {
			assert.strictEqual(isQueryCanceledError(new Error("57014")), false);
			assert.strictEqual(isQueryCanceledError(null), false);
		});
	});
});
