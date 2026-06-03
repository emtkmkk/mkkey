process.env.NODE_ENV = "test";

import * as assert from "assert";
import * as childProcess from "child_process";
import { async, signup, startServer, shutdownServer } from "./utils.js";
import { buildMinimalNotificationPayloadForPush } from "../src/services/push-notification.js";

describe("push-notification", () => {
	let p: childProcess.ChildProcess;
	let alice: { id: string; token: string };

	before(async () => {
		p = await startServer();
		alice = await signup({ username: "push_alice" });
	});

	after(async () => {
		await shutdownServer(p);
	});

	it("正常系: 購読が無い場合 test-push-notification は no_subscriptions を返す", async(async () => {
		const res = await fetch("http://localhost:61812/api/i/test-push-notification", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${alice.token}`,
			},
			body: JSON.stringify({}),
		});
		const body = await res.json();
		assert.strictEqual(body.ok, false);
		assert.strictEqual(body.subscriptionCount, 0);
	}));

	it("境界値: minimal ペイロードに userId と user が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif1",
			type: "wasBlocked",
			userId: "user1",
			user: {
				id: "user1",
				username: "alice",
				name: "Alice",
				avatarUrl: "https://example.com/avatar.png",
			},
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual(result.id, "notif1");
		assert.strictEqual(result.type, "wasBlocked");
		assert.strictEqual(result.userId, "user1");
		assert.deepStrictEqual(result.user, {
			id: "user1",
			username: "alice",
			name: "Alice",
			avatarUrl: "https://example.com/avatar.png",
		});
		assert.strictEqual((result as { note?: unknown }).note, undefined);
	});

	it("正常系: dev モードでない場合 push-log は空配列", async(async () => {
		const res = await fetch("http://localhost:61812/api/i/push-log", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${alice.token}`,
			},
			body: JSON.stringify({ limit: 10 }),
		});
		assert.strictEqual(res.status, 200);
		const body = await res.json();
		assert.ok(Array.isArray(body));
		assert.strictEqual(body.length, 0);
	}));
});
