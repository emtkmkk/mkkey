/**
 * @packageDocumentation
 *
 * {@link fetchPackedNotesWithOverfetch} とページング方向判定の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import type { SelectQueryBuilder } from "typeorm";
import type { Note } from "@/models/entities/note.js";
import {
	applyKeysetCursorToQuery,
	isPaginationQueryAsc,
} from "../../../src/server/api/common/timeline-pagination-cursor.js";

describe("fetch-packed-notes-with-overfetch / isPaginationQueryAsc", () => {
	it("正常系：sinceId のみの場合、ASC（id > カーソル）になる", () => {
		assert.strictEqual(
			isPaginationQueryAsc({ sinceId: "abc" }),
			true,
		);
	});

	it("正常系：untilId のみの場合、DESC（id < カーソル）になる", () => {
		assert.strictEqual(
			isPaginationQueryAsc({ untilId: "abc" }),
			false,
		);
	});

	it("正常系：sinceId と untilId の両方の場合、DESC になる", () => {
		assert.strictEqual(
			isPaginationQueryAsc({ sinceId: "a", untilId: "z" }),
			false,
		);
	});

	it("正常系：sinceDate のみの場合、ASC になる", () => {
		assert.strictEqual(
			isPaginationQueryAsc({ sinceDate: 1 }),
			true,
		);
	});

	it("正常系：untilDate のみの場合、DESC になる", () => {
		assert.strictEqual(
			isPaginationQueryAsc({ untilDate: 1 }),
			false,
		);
	});

	it("正常系：ページング未指定の場合、DESC になる", () => {
		assert.strictEqual(isPaginationQueryAsc({}), false);
	});
});

describe("fetch-packed-notes-with-overfetch / applyKeysetCursorToQuery", () => {
	it("正常系：ASC では id > カーソル条件を付与する", () => {
		const calls: Array<{ sql: string; params: Record<string, string> }> =
			[];
		const qb = {
			andWhere(sql: string, params?: Record<string, string>) {
				calls.push({ sql, params: params ?? {} });
				return qb;
			},
		} as unknown as SelectQueryBuilder<Note>;

		applyKeysetCursorToQuery(qb, "note", "cursor-id", true, "timelineMoreCursor");

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0]!.sql, "note.id > :timelineMoreCursor");
		assert.strictEqual(calls[0]!.params.timelineMoreCursor, "cursor-id");
	});

	it("正常系：DESC では id < カーソル条件を付与する", () => {
		const calls: Array<{ sql: string; params: Record<string, string> }> =
			[];
		const qb = {
			andWhere(sql: string, params?: Record<string, string>) {
				calls.push({ sql, params: params ?? {} });
				return qb;
			},
		} as unknown as SelectQueryBuilder<Note>;

		applyKeysetCursorToQuery(qb, "note", "cursor-id", false, "ltlMoreCursor");

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0]!.sql, "note.id < :ltlMoreCursor");
		assert.strictEqual(calls[0]!.params.ltlMoreCursor, "cursor-id");
	});
});
