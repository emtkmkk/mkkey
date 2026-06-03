/**
 * @packageDocumentation
 *
 * 認証ユーザー自身宛にテスト用プッシュ通知を送る API。
 *
 * @remarks
 * - `notificationType` 指定時は dev モード（registry developer）必須。SW compose 経路の検証用。
 * - 手動確認: SW 更新後・該当種別を設定で ON・背景タブで OS 通知を確認する。
 *
 * @internal
 */
import define from "../../define.js";
import { genId } from "@/misc/gen-id.js";
import { pushNotification } from "@/services/push-notification.js";
import { SwSubscriptions, Users } from "@/models/index.js";
import { isDeveloperUser } from "@/misc/is-developer-user.js";
import { notificationTypes } from "@/types.js";
import { ApiError } from "../../error.js";
import type { Packed } from "@/misc/schema.js";

/** dev 向けテスト送信可能な通知種別 */
const DEV_TEST_NOTIFICATION_TYPES = [
	"userWasUnfollowed",
	"wasForciblyUnfollowed",
	"wasBlocked",
	"wasUnblocked",
	"followedAccountWasDeleted",
	"follow",
] as const;

export const meta = {
	tags: ["account"],
	requireCredential: true,
	secure: true,
	description: "プッシュ通知の疎通確認用に、自分宛てテスト通知を送信する。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		notificationType: {
			type: "string",
			nullable: true,
			enum: ["app", ...DEV_TEST_NOTIFICATION_TYPES],
		},
	},
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const subscriptions = await SwSubscriptions.findBy({ userId: me.id });
	const subscriptionCount = subscriptions.length;

	if (subscriptionCount === 0) {
		return {
			ok: false,
			subscriptionCount: 0,
			message: "no_subscriptions",
		};
	}

	const requestedType = ps.notificationType ?? "app";

	if (
		requestedType !== "app" &&
		!(DEV_TEST_NOTIFICATION_TYPES as readonly string[]).includes(
			requestedType,
		)
	) {
		throw new ApiError({
			message: "Invalid notification type.",
			code: "INVALID_PARAM",
			id: "invalid-notification-type",
		});
	}

	if (requestedType !== "app" && !(await isDeveloperUser(me.id))) {
		throw new ApiError({
			message: "Developer mode is required for this notification type.",
			code: "PERMISSION_DENIED",
			id: "dev-required",
		});
	}

	let testNotification: Packed<"Notification">;

	if (requestedType === "app") {
		testNotification = {
			id: genId(),
			createdAt: new Date().toISOString(),
			type: "app",
			isRead: false,
			header: "プッシュ通知テスト",
			body: "通知が届きました。",
		} as Packed<"Notification">;
	} else {
		const packedUser = await Users.pack(me.id, { id: me.id });
		testNotification = {
			id: genId(),
			createdAt: new Date().toISOString(),
			type: requestedType as (typeof notificationTypes)[number],
			isRead: false,
			userId: me.id,
			user: packedUser,
		} as Packed<"Notification">;
	}

	await pushNotification(me.id, "notification", testNotification);

	return {
		ok: true,
		subscriptionCount,
		message: "sent",
		notificationType: requestedType,
	};
});
