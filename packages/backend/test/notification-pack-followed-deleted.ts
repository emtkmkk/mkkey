process.env.NODE_ENV = "test";

import * as assert from "assert";
import type * as childProcess from "child_process";
import { genId } from "@/misc/gen-id.js";
import { Notifications, Users } from "@/models/index.js";
import { deleteAccount } from "@/services/delete-account.js";
import {
	async,
	request,
	signup,
	startServer,
	shutdownServer,
} from "./utils.js";

describe("followedAccountWasDeleted notification pack", () => {
	let p: childProcess.ChildProcess;

	before(async () => {
		p = await startServer();
	});

	after(async () => {
		await shutdownServer(p);
	});

	it(
		"正常系: customBody ありのとき削除済みユーザーの表示名を保持する",
		async(async () => {
			const suffix = Date.now().toString(36);
			const follower = await signup({ username: `nf_follower_${suffix}` });
			const deletedUser = await signup({ username: `nf_deleted_${suffix}` });
			const displayName = "削除前の表示名";

			await request("/i/update", { name: displayName }, deletedUser);
			await request(
				"/following/create",
				{ userId: deletedUser.id },
				follower,
			);

			const userEntity = await Users.findOneByOrFail({ id: deletedUser.id });
			await deleteAccount(userEntity);

			const res = await request("/i/notifications", {}, follower);
			const notif = res.body.find(
				(n: { type: string }) => n.type === "followedAccountWasDeleted",
			);

			assert.ok(notif, "followedAccountWasDeleted 通知が存在すること");
			assert.strictEqual(notif.customBody, displayName);
			assert.strictEqual(notif.user.name, displayName);
		}),
	);

	it(
		"境界値: customBody なしの旧データは削除済み表示（🗑）のまま",
		async(async () => {
			const suffix = Date.now().toString(36);
			const follower = await signup({ username: `nf_legacy_follower_${suffix}` });
			const deletedUser = await signup({
				username: `nf_legacy_deleted_${suffix}`,
			});

			await Users.update(deletedUser.id, { isDeleted: true });

			const notification = await Notifications.insert({
				id: genId(),
				createdAt: new Date(),
				notifieeId: follower.id,
				notifierId: deletedUser.id,
				type: "followedAccountWasDeleted",
				isRead: false,
			}).then((x) => Notifications.findOneByOrFail(x.identifiers[0]));

			const packed = await Notifications.pack(notification);

			assert.ok(packed);
			assert.strictEqual(packed.user?.name, "🗑");
		}),
	);
});
