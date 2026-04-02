/**
 * @packageDocumentation
 *
 * 管理者が指定ローカルユーザーの利用を一時停止する API。
 *
 * @remarks
 * 凍結と異なり Delete アクティビティ・unFollowAll は行わない。ストリームは terminate する。
 *
 * @internal
 */
import define from "../../define.js";
import { Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import {
	publishInternalEvent,
	publishUserEvent,
} from "@/services/stream.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error("user not found");
	}

	if (!Users.isLocalUser(user)) {
		throw new Error("usage pause is for local users only");
	}

	if (user.isAdmin) {
		throw new Error("cannot pause admin");
	}

	if (user.isModerator) {
		throw new Error("cannot pause moderator");
	}

	await Users.update(user.id, {
		isUsagePaused: true,
	});

	insertModerationLog(me, "pauseUsage", {
		targetId: user.id,
	});

	publishUserEvent(user.id, "terminate", {});

	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);
	publishInternalEvent("localUserUpdated", { id: user.id });
});
