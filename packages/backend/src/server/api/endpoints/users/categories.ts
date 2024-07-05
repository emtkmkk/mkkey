import { EmojiCustomCategories } from "@/models/index.js";
import define from "../../define.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";

export const meta = {
	tags: ["users", "categories"],
	requireCredentialPrivateMode: true,

	description: "Show all categories this user created.",

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
		userId: { type: "string", format: "misskey:id" },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const query = makePaginationQuery(
		EmojiCustomCategories.createQueryBuilder("category"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere("category.userId = :userId", { userId: ps.userId })

	const categories = await query.take(ps.limit).getMany();

	return await EmojiCustomCategories.packMany(categories);
});
