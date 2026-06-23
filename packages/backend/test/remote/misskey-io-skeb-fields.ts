/**
 * @packageDocumentation
 *
 * `misskey-io-skeb-fields` の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	appendMisskeyIoSkebFieldIfNeeded,
	clearMisskeyIoSkebStatusCacheForTests,
	extractMisskeyIoUserIdFromPersonId,
	setMisskeyIoSkebStatusCacheForTests,
} from "../../src/remote/activitypub/models/misskey-io-skeb-fields.js";
import type { IActor } from "../../src/remote/activitypub/type.js";

describe("misskey-io-skeb-fields", () => {
	afterEach(() => {
		clearMisskeyIoSkebStatusCacheForTests();
	});

	describe("extractMisskeyIoUserIdFromPersonId", () => {
		it("misskey.io の Person id から userId を抽出する", () => {
			const userId = extractMisskeyIoUserIdFromPersonId(
				"https://misskey.io/users/abc123xyz",
			);
			assert.strictEqual(userId, "abc123xyz");
		});

		it("末尾スラッシュ付き id からも userId を抽出する", () => {
			const userId = extractMisskeyIoUserIdFromPersonId(
				"https://misskey.io/users/abc123xyz/",
			);
			assert.strictEqual(userId, "abc123xyz");
		});

		it("別ホストの Person id の場合、null を返す", () => {
			const userId = extractMisskeyIoUserIdFromPersonId(
				"https://example.com/users/abc123xyz",
			);
			assert.strictEqual(userId, null);
		});

		it("不正な URL の場合、null を返す", () => {
			assert.strictEqual(extractMisskeyIoUserIdFromPersonId(undefined), null);
			assert.strictEqual(extractMisskeyIoUserIdFromPersonId(""), null);
		});
	});

	describe("appendMisskeyIoSkebFieldIfNeeded", () => {
		const person: IActor = {
			type: "Person",
			id: "https://misskey.io/users/testuserid",
			preferredUsername: "testuser",
			inbox: "https://misskey.io/users/testuserid/inbox",
			outbox: "https://misskey.io/users/testuserid/outbox",
		};

		it("misskey.io 以外のホストの場合、fields を変更しない", async () => {
			const fields = [{ name: "link", value: "https://example.com" }];
			const result = await appendMisskeyIoSkebFieldIfNeeded(
				person,
				fields,
				"example.com",
				{ style: "create" },
			);
			assert.deepStrictEqual(result, fields);
		});

		it("既に Skeb フィールドがある場合、API を呼ばず fields を変更しない", async () => {
			const fields = [{ name: "★Skeb", value: "existing" }];
			const result = await appendMisskeyIoSkebFieldIfNeeded(
				person,
				fields,
				"misskey.io",
				{ style: "create" },
			);
			assert.deepStrictEqual(result, fields);
		});

		it("キャッシュ済み Skeb 情報がある場合、HTTP なしでフィールドを追記する", async () => {
			setMisskeyIoSkebStatusCacheForTests("testuserid", {
				isAcceptable: true,
				isCreator: true,
				screenName: "testscreen",
				creatorRequestCount: 3,
			});

			const fields: { name: string; value: string }[] = [];
			const result = await appendMisskeyIoSkebFieldIfNeeded(
				person,
				fields,
				"misskey.io",
				{ style: "create" },
			);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].name, "★Skeb");
			assert.match(result[0].value, /募集中/);
			assert.match(result[0].value, /testscreen/);
		});

		it("update スタイルの場合、Skeb(自動) フィールドを追記する", async () => {
			setMisskeyIoSkebStatusCacheForTests("testuserid", {
				isAcceptable: false,
				isCreator: true,
				screenName: "updateuser",
			});

			const result = await appendMisskeyIoSkebFieldIfNeeded(
				person,
				[],
				"misskey.io",
				{ style: "update" },
			);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].name, "Skeb(自動)");
			assert.match(result[0].value, /停止中/);
		});
	});
});
