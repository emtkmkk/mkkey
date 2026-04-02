/**
 * @packageDocumentation
 *
 * 管理者が指定ユーザーの一時利用停止を解除する API。
 *
 * @internal
 */
import define from "../../define.js";
import { Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { publishInternalEvent } from "@/services/stream.js";

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

	await Users.update(user.id, {
		isUsagePaused: false,
	});

	insertModerationLog(me, "unpauseUsage", {
		targetId: user.id,
	});

	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);
	publishInternalEvent("localUserUpdated", { id: user.id });
});
