/**
 * @packageDocumentation
 *
 * ユーザー凍結（Delete 配信等）を行うサービス。
 *
 * @remarks
 * - **役割**: 管理者による凍結処理で呼ばれ、ローカルユーザーは Delete を配信し、内部イベントで状態を通知する。
 *
 * @see {@link endpoints/admin/suspend-user} 凍結 API
 * @internal
 */
import renderDelete from "@/remote/activitypub/renderer/delete.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { deliver } from "@/queue/index.js";
import config from "@/config/index.js";
import type { User } from "@/models/entities/user.js";
import { Users, Followings } from "@/models/index.js";
import { Not, IsNull } from "typeorm";
import { publishInternalEvent } from "@/services/stream.js";
import { apLogger } from "@/remote/activitypub/logger.js";

export async function doPostSuspend(user: {
	id: User["id"];
	host: User["host"];
}) {
	publishInternalEvent("userChangeSuspendedState", {
		id: user.id,
		isSuspended: true,
	});

	if (Users.isLocalUser(user)) {
		// 既知のすべての SharedInbox に Delete を送信
		const content = renderActivity(
			renderDelete(`${config.url}/users/${user.id}`, user),
		);

		const queue: string[] = [];

		const followings = await Followings.find({
			where: [
				{ followerSharedInbox: Not(IsNull()) },
				{ followeeSharedInbox: Not(IsNull()) },
			],
			select: ["followerSharedInbox", "followeeSharedInbox"],
		});

		const inboxes = followings.map(
			(x) => x.followerSharedInbox || x.followeeSharedInbox,
		);

		apLogger.info(`delete Activity Send: ${inboxes.length}`);

		for (const inbox of inboxes) {
			if (inbox != null && !queue.includes(inbox)) queue.push(inbox);
		}

		for (const inbox of queue) {
			deliver(user, content, inbox, true);
		}
	}
}
