/**
 * @packageDocumentation
 *
 * 管理者が指定ユーザーにモデレーション警告フラグを付与する API。
 *
 * @remarks
 * ローカル・リモートユーザの双方に付与可能（当インスタンス上の表示・TL判定用）。
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

	if (user.isAdmin) {
		throw new Error("cannot set moderation warning on admin");
	}

	await Users.update(user.id, {
		isModerationWarning: true,
	});

	insertModerationLog(me, "moderationWarning", {
		targetId: user.id,
	});

	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);
	publishInternalEvent("localUserUpdated", { id: user.id });
});
