process.env.NODE_ENV = "test";

import * as assert from "assert";
import * as childProcess from "child_process";
import {
	isPureRenote,
	NO_SUCH_REFERENCE_TARGET_ERROR_ID,
	referencesCollectionHasSubstance,
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

	describe("referencesCollectionHasSubstance", () => {
		it("正常系：Fedibird 典型の空 shell の場合、false になる", () => {
			assert.strictEqual(
				referencesCollectionHasSubstance({
					type: "Collection",
					first: { items: [] },
				}),
				false,
			);
		});

		it("正常系：totalItems > 0 でも items が空の場合、false になる", () => {
			assert.strictEqual(
				referencesCollectionHasSubstance({
					type: "Collection",
					totalItems: 3,
					first: { items: [] },
				}),
				false,
			);
		});

		it("正常系：first.items に URI がある場合、true になる", () => {
			assert.strictEqual(
				referencesCollectionHasSubstance({
					type: "Collection",
					first: {
						items: ["https://example.com/users/a/status/1"],
					},
				}),
				true,
			);
		});

		it("正常系：first.next があるだけの場合、false になる", () => {
			assert.strictEqual(
				referencesCollectionHasSubstance({
					type: "Collection",
					first: {
						items: [],
						next: "https://example.com/status/1/references?page=2",
					},
				}),
				false,
			);
		});

		it("正常系：Collection 直下の items がある場合、true になる", () => {
			assert.strictEqual(
				referencesCollectionHasSubstance({
					type: "Collection",
					items: ["https://example.com/users/a/status/1"],
				}),
				true,
			);
		});

		it("正常系：first が URL 文字列だけの場合、false になる", () => {
			assert.strictEqual(
				referencesCollectionHasSubstance({
					type: "Collection",
					first: "https://example.com/status/1/references?page=1",
				}),
				false,
			);
		});

		it("正常系：Collection 直下に next があるだけの場合、false になる", () => {
			assert.strictEqual(
				referencesCollectionHasSubstance({
					type: "Collection",
					next: "https://example.com/status/1/references?page=2",
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
