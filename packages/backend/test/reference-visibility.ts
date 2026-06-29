process.env.NODE_ENV = "test";

import * as assert from "assert";
import * as childProcess from "child_process";
import {
	isPureRenote,
	NO_SUCH_REFERENCE_TARGET_ERROR_ID,
} from "../src/services/note/reference-visibility.js";
import {
	async,
	signup,
	request,
	startServer,
	shutdownServer,
	initTestDb,
} from "./utils.js";

describe("reference-visibility", () => {
	describe("isPureRenote", () => {
		it("正常系：純粋 RT の場合、true になる", () => {
			assert.strictEqual(
				isPureRenote({
					renoteId: "a",
					text: null,
					fileIds: [],
					hasPoll: false,
				}),
				true,
			);
		});

		it("正常系：テキスト付き RN の場合、false になる", () => {
			assert.strictEqual(
				isPureRenote({
					renoteId: "a",
					text: "quote",
					fileIds: [],
					hasPoll: false,
				}),
				false,
			);
		});
	});

	describe("validateReferenceIds（API 経由）", () => {
		let p: childProcess.ChildProcess;
		let alice: { id: string; token: string };
		let bob: { id: string; token: string };

		before(async () => {
			p = await startServer();
			await initTestDb(true);
			alice = await signup({ username: "ref_alice" });
			bob = await signup({ username: "ref_bob" });
		});

		after(async () => {
			await shutdownServer(p);
		});

		it("正常系：公開ノートを参照指定して投稿できる", async () => {
			const target = await request(
				"/notes/create",
				{ text: "reference target" },
				alice,
			);
			assert.strictEqual(target.status, 200);

			const res = await request(
				"/notes/create",
				{
					text: "with ref",
					referenceIds: [target.body.createdNote.id],
				},
				alice,
			);
			assert.strictEqual(res.status, 200);
			assert.ok(res.body.createdNote.referenceIds?.includes(target.body.createdNote.id));
		});

		it("異常系：存在しない ID を参照指定すると NO_SUCH_REFERENCE_TARGET になる", async () => {
			const res = await request(
				"/notes/create",
				{
					text: "bad ref",
					referenceIds: ["xxxxxxxxxx"],
				},
				alice,
			);
			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.id, NO_SUCH_REFERENCE_TARGET_ERROR_ID);
		});

		it("異常系：followers 限定投稿を他ユーザーが参照指定すると拒否される", async () => {
			const target = await request(
				"/notes/create",
				{
					text: "followers only",
					visibility: "followers",
				},
				alice,
			);
			assert.strictEqual(target.status, 200);

			const res = await request(
				"/notes/create",
				{
					text: "steal ref",
					referenceIds: [target.body.createdNote.id],
				},
				bob,
			);
			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.id, NO_SUCH_REFERENCE_TARGET_ERROR_ID);
		});
	});
});
