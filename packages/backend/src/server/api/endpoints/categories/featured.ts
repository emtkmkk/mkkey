import { EmojiCustomCategories } from "@/models/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["categories"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "EmojiCustomCategory",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const query = EmojiCustomCategories.createQueryBuilder("category")
		.orderBy("id", "DESC");

	const categories = await query.take(ps.limit || 10).getMany();

	return await EmojiCustomCategories.packMany(categories, me);
});
