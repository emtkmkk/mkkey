import { UserLists } from "@/models/index.js";
import define from "../../../define.js";
import type { UserList } from "@/models/entities/user-list.js";

export const meta = {
	tags: ["lists", "account"],

	requireCredential: true,

	kind: "read:account",

	description: "認証ユーザーが作成したユーザーリスト一覧を取得します。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "UserList",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const userLists: Array<UserList|string> = await UserLists.findBy({
		userId: me.id,
	});

	if (me.isAdmin) {
		userLists.push("0000000000");
	}

	return await Promise.all(userLists.map((x) => UserLists.pack(x)));
});
