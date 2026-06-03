/**
 * @packageDocumentation
 *
 * 認証ユーザー自身宛にテスト用プッシュ通知を送る API。
 *
 * @internal
 */
import define from "../../define.js";
import { genId } from "@/misc/gen-id.js";
import { pushNotification } from "@/services/push-notification.js";
import { SwSubscriptions } from "@/models/index.js";
import type { Packed } from "@/misc/schema.js";

export const meta = {
	tags: ["account"],
	requireCredential: true,
	secure: true,
	description: "プッシュ通知の疎通確認用に、自分宛てテスト通知を送信する。",
} as const;

export const paramDef = {
	type: "object",
	properties: {},
} as const;

export default define(meta, paramDef, async (_ps, me) => {
	const subscriptions = await SwSubscriptions.findBy({ userId: me.id });
	const subscriptionCount = subscriptions.length;

	if (subscriptionCount === 0) {
		return {
			ok: false,
			subscriptionCount: 0,
			message: "no_subscriptions",
		};
	}

	const testNotification = {
		id: genId(),
		createdAt: new Date().toISOString(),
		type: "app",
		isRead: false,
		header: "プッシュ通知テスト",
		body: "通知が届きました。",
	} as Packed<"Notification">;

	await pushNotification(me.id, "notification", testNotification);

	return {
		ok: true,
		subscriptionCount,
		message: "sent",
	};
});
