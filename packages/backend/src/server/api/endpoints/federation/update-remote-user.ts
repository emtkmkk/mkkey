import { HOUR } from "@/const.js";
import define from "../../define.js";
import { getRemoteUser } from "../../common/getters.js";
import { updatePerson } from "@/remote/activitypub/models/person.js";

export const meta = {
	tags: ["federation"],

	requireCredential: true,
	kind: "read:account",

	// NOTE: 呼ぶたびにリモートサーバーへの取得が走るため、回数を制限する（Misskey 2026.9.1 の修正を移植）
	limit: {
		duration: HOUR,
		max: 30,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const user = await getRemoteUser(ps.userId);
	await updatePerson(user.uri!);
});
