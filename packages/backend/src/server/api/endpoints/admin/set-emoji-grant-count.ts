import { IsNull } from "typeorm";
import define from "../../define.js";
import { Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { publishInternalEvent } from "@/services/stream.js";
import { MAX_EMOJI_DRIVE_GRANTS } from "@/const.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:support",

	description:
		"自作絵文字ボーナスの適用回数を直接設定する。ドライブ容量は変更しない。過去分の取り込みと訂正用。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		username: { type: "string" },
		count: { type: "integer", minimum: 0, maximum: MAX_EMOJI_DRIVE_GRANTS },
	},
	required: ["username", "count"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({
		usernameLower: ps.username.toLowerCase(),
		host: IsNull(),
	});

	if (user == null) {
		throw new Error("user not found");
	}

	const before = user.emojiDriveGrantCount;

	await Users.update(user.id, { emojiDriveGrantCount: ps.count });

	publishInternalEvent("localUserUpdated", { id: user.id });
	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);

	await insertModerationLog(me, "set-emoji-grant-count", {
		targetId: user.id,
		username: user.username,
		before,
		after: ps.count,
	});

	return {
		username: user.username,
		before,
		used: ps.count,
		max: MAX_EMOJI_DRIVE_GRANTS,
		remaining: MAX_EMOJI_DRIVE_GRANTS - ps.count,
	};
});
