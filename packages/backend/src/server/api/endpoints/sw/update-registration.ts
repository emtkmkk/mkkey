import { SwSubscriptions } from "@/models/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	description: "プッシュ通知の登録情報を更新します。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		endpoint: { type: "string" },
		sendReadMessage: { type: "boolean" },
	},
	required: ["endpoint"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const swSubscription = await SwSubscriptions.findOneBy({
		userId: me.id,
		endpoint: ps.endpoint,
	});

	if (swSubscription === null) {
		throw new Error("No such registration");
	}

	if (ps.sendReadMessage !== undefined) {
		swSubscription.sendReadMessage = ps.sendReadMessage;
	}

	await SwSubscriptions.update(swSubscription.id, {
		sendReadMessage: swSubscription.sendReadMessage,
	});

	return {
		userId: swSubscription.userId,
		endpoint: swSubscription.endpoint,
		sendReadMessage: swSubscription.sendReadMessage,
	};
});
