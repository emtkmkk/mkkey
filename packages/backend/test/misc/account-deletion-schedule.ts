/**
 * @packageDocumentation
 *
 * アカウント削除の予約の日時の決め方（日本時間）の単体テスト。
 *
 * @internal
 */

process.env.NODE_ENV = "test";

import * as assert from "assert";
import {
	computeAccountDeletionReRequestableAt,
	computeAccountDeletionScheduledAt,
} from "../../src/misc/account-deletion-schedule.js";

/** 日本時間の文字列を Date にする（テストを読みやすくするため） */
const jst = (s: string) => new Date(`${s}+09:00`);

describe("アカウント削除の予約の日時", () => {
	describe("computeAccountDeletionScheduledAt", () => {
		it("正常系：20:00 より前の予約の場合、翌日 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-27T10:00:00")),
				jst("2026-11-28T02:00:00"),
			);
		});

		it("正常系：20:00 以降の予約の場合、翌々日 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-27T21:00:00")),
				jst("2026-11-29T02:00:00"),
			);
		});

		it("境界値：19:59 の予約の場合、翌日 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-27T19:59:59")),
				jst("2026-11-28T02:00:00"),
			);
		});

		it("境界値：20:00 ちょうどの予約の場合、翌々日 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-27T20:00:00")),
				jst("2026-11-29T02:00:00"),
			);
		});

		it("境界値：0:00 の予約の場合、その日付の翌日 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-28T00:00:00")),
				jst("2026-11-29T02:00:00"),
			);
		});

		it("境界値：1:59 の予約の場合、その夜の 2:00 ではなく翌日 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-28T01:59:59")),
				jst("2026-11-29T02:00:00"),
			);
		});

		it("境界値：2:00 ちょうどの予約の場合、翌日 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-28T02:00:00")),
				jst("2026-11-29T02:00:00"),
			);
		});

		it("境界値：月末の 21:00 の予約の場合、翌月 2 日の 2:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionScheduledAt(jst("2026-11-30T21:00:00")),
				jst("2026-12-02T02:00:00"),
			);
		});
	});

	describe("computeAccountDeletionReRequestableAt", () => {
		it("正常系：20:00 より前に取り消した場合、その日の 20:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionReRequestableAt(jst("2026-11-27T11:00:00")),
				jst("2026-11-27T20:00:00"),
			);
		});

		it("正常系：20:00 より後に取り消した場合、翌日の 20:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionReRequestableAt(jst("2026-11-27T21:00:00")),
				jst("2026-11-28T20:00:00"),
			);
		});

		it("境界値：20:00 ちょうどに取り消した場合、翌日の 20:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionReRequestableAt(jst("2026-11-27T20:00:00")),
				jst("2026-11-28T20:00:00"),
			);
		});

		it("境界値：0:30 に取り消した場合、その日の 20:00 になる", () => {
			assert.deepStrictEqual(
				computeAccountDeletionReRequestableAt(jst("2026-11-28T00:30:00")),
				jst("2026-11-28T20:00:00"),
			);
		});
	});
});
