import define from "../../define.js";
import { Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { publishInternalEvent } from "@/services/stream.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:suspend-user",
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

	if (ps.mini) {
		await Users.update(user.id, {
			isMiniSilenced: false,
		});

		publishInternalEvent("userChangeSilencedState", {
			id: user.id,
			isMiniSilenced: false,
		});

		insertModerationLog(me, "mini-unsilence", {
			targetId: user.id,
		});
	} else {
		await Users.update(user.id, {
			isSilenced: false,
		});

		publishInternalEvent("userChangeSilencedState", {
			id: user.id,
			isSilenced: false,
		});

		insertModerationLog(me, "unsilence", {
			targetId: user.id,
		});
	}
});
