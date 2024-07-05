import { EmojiCustomCategories } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["categories"],

	requireCredential: true,

	kind: "write:categories",

	errors: {
		noSuchPage: {
			message: "そのcategoryは存在しません。",
			code: "NO_SUCH_PAGE",
			id: "eb0c6e1d-d519-4764-9486-52a7e1c6392a",
		},

		accessDenied: {
			message: "アクセスが拒否されました。",
			code: "ACCESS_DENIED",
			id: "8b741b3e-2c22-44b3-a15f-29949aa1601e",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		categoryId: { type: "string", format: "misskey:id" },
	},
	required: ["categoryId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const category = await EmojiCustomCategories.findOneBy({ id: ps.categoryId });
	if (category == null) {
		throw new ApiError(meta.errors.noSuchPage);
	}
	if (category.userId !== user.id) {
		throw new ApiError(meta.errors.accessDenied);
	}

	await EmojiCustomCategories.delete(category.id);
});
