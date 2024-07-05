import { IsNull } from "typeorm";
import { EmojiCustomCategories, Users } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import type { EmojiCustomCategory } from "@/models/entities/emoji-custom-category.js";

export const meta = {
	tags: ["pages"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		anyOf: [
			{
				type: "object",
				optional: false,
				nullable: false,
				ref: "EmojiCustomCategory",
			},
			{
				type: "array",
				items: {
					type: "object",
					optional: false,
					nullable: false,
					ref: "EmojiCustomCategory",
				},
			},
		]
	},

	errors: {
		noSuchPage: {
			message: "そのcategoryは存在しません。",
			code: "NO_SUCH_CUSTOM_CATEGORY",
			id: "222120c0-3ead-4528-811b-b96f233388d7",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	anyOf: [
		{
			properties: {
				categoryId: { type: "string", format: "misskey:id" },
			},
			required: ["categoryId"],
		},
		{
			properties: {
				name: { type: "string" },
				username: { type: "string" },
			},
			required: ["name", "username"],
		},
		{
			properties: {
				categoryId: {
					type: "array",
					items: {
						type: "string",
						format: "misskey:id",
					},
				},
			},
			required: ["categoryId"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let category: EmojiCustomCategory | null = null;

	if (Array.isArray(ps.categoryId)) {
		const promises = ps.categoryId.map(async (x) => {
			try {
				return await EmojiCustomCategories.pack(x, user);
			} catch (error) {
				return null;
			}
		});

		const results = await Promise.all(promises);
		return results.filter(result => result !== null);
	}
	if (ps.categoryId) {
		category = await EmojiCustomCategories.findOneBy({ id: ps.categoryId });
	} else if (ps.name && ps.username) {
		const author = await Users.findOneBy({
			host: IsNull(),
			usernameLower: ps.username.toLowerCase(),
		});
		if (author) {
			category = await EmojiCustomCategories.findOneBy({
				name: ps.name,
				userId: author.id,
			});
		}
	}

	if (category == null) {
		throw new ApiError(meta.errors.noSuchPage);
	}

	return await EmojiCustomCategories.pack(category, user);
});
