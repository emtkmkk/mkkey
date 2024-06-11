import { UserLists, Users } from "@/models/index.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import type { UserList } from "@/models/entities/user-list.js";

export const meta = {
	tags: ["lists", "account"],

	requireCredential: true,

	kind: "read:account",

	description: "Show the properties of a list.",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "UserList",
	},

	errors: {
		noSuchList: {
			message: "そのlistは存在しません。",
			code: "NO_SUCH_LIST",
			id: "7bc05c21-1d7a-41ae-88f1-66820f4dc686",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		listId: { type: "string", format: "misskey:id" },
	},
	required: ["listId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// Fetch the list
	let userList: UserList | string | null = await UserLists.findOneBy({
		id: ps.listId,
		userId: me.id,
	});

	if (userList == null) {
		if (!me.isAdmin || ps.listId !== "0000000000") {
			throw new ApiError(meta.errors.noSuchList);
		}
		userList = "0000000000";
	}

	return await UserLists.pack(userList);
});
