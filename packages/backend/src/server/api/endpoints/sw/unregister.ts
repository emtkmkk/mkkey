import { SwSubscriptions } from "@/models/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["account"],

	requireCredential: false,

	description: "プッシュ通知の登録を解除します。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		endpoint: { type: "string" },
	},
	required: ["endpoint"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	await SwSubscriptions.delete({
		...(me ? { userId: me.id } : {}),
		endpoint: ps.endpoint,
	});
});
