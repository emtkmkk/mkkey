process.env.NODE_ENV = "test";

import * as assert from "assert";
import * as childProcess from "child_process";
import { async, signup, startServer, shutdownServer, request } from "./utils.js";
import { shouldDeliverDelayedNotification } from "../src/services/should-deliver-delayed-notification.js";

describe("shouldDeliverDelayedNotification", () => {
	let p: childProcess.ChildProcess;
	let alice: Awaited<ReturnType<typeof signup>>;
	let carol: Awaited<ReturnType<typeof signup>>;

	before(async () => {
		p = await startServer();
		alice = await signup({ username: "alice" });
		carol = await signup({ username: "carol" });
	});

	after(async () => {
		await shutdownServer(p);
	});

	it("正常系: ミュートしていないユーザーからの配信は許可する", async(async () => {
		const deliver = await shouldDeliverDelayedNotification(alice.id, carol.id);
		assert.strictEqual(deliver, true);
	}));

	it("異常系: ミュート中ユーザーからの配信は抑止する", async(async () => {
		const res = await request(
			"/mute/create",
			{ userId: carol.id },
			alice,
		);
		assert.strictEqual(res.status, 204);

		const deliver = await shouldDeliverDelayedNotification(alice.id, carol.id);
		assert.strictEqual(deliver, false);
	}));
});
