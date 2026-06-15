process.env.NODE_ENV = "test";

import * as assert from "assert";
import * as childProcess from "child_process";
import { async, signup, startServer, shutdownServer, request } from "./utils.js";
import {
	extractNotifierIdForPushMute,
	isNotifierPushMuted,
} from "../src/services/push-notification.js";

describe("push-mute", () => {
	let p: childProcess.ChildProcess;
	let alice: Awaited<ReturnType<typeof signup>>;
	let bob: Awaited<ReturnType<typeof signup>>;

	before(async () => {
		p = await startServer();
		alice = await signup({ username: "push_mute_alice" });
		bob = await signup({ username: "push_mute_bob" });
	});

	after(async () => {
		await shutdownServer(p);
	});

	describe("extractNotifierIdForPushMute", () => {
		it("正常系: notification の userId を取り出す", () => {
			const id = extractNotifierIdForPushMute("notification", {
				userId: bob.id,
			});
			assert.strictEqual(id, bob.id);
		});

		it("正常系: unreadMessagingMessage の user.id を取り出す", () => {
			const id = extractNotifierIdForPushMute("unreadMessagingMessage", {
				user: { id: bob.id },
			});
			assert.strictEqual(id, bob.id);
		});

		it("境界値: readNotifications は undefined", () => {
			const id = extractNotifierIdForPushMute("readNotifications", {
				notificationIds: ["x"],
			});
			assert.strictEqual(id, undefined);
		});
	});

	describe("isNotifierPushMuted", () => {
		it("正常系: 未登録なら false", async(async () => {
			const muted = await isNotifierPushMuted(alice.id, bob.id);
			assert.strictEqual(muted, false);
		}));

		it("正常系: push-mute 登録後は true", async(async () => {
			const res = await request(
				"/push-mute/create",
				{ userId: bob.id },
				alice,
			);
			assert.strictEqual(res.status, 204);

			const muted = await isNotifierPushMuted(alice.id, bob.id);
			assert.strictEqual(muted, true);
		}));

		it("正常系: push-mute 解除後は false", async(async () => {
			const res = await request(
				"/push-mute/delete",
				{ userId: bob.id },
				alice,
			);
			assert.strictEqual(res.status, 204);

			const muted = await isNotifierPushMuted(alice.id, bob.id);
			assert.strictEqual(muted, false);
		}));

		it("境界値: 自分自身は常に false", async(async () => {
			const muted = await isNotifierPushMuted(alice.id, alice.id);
			assert.strictEqual(muted, false);
		}));
	});
});
