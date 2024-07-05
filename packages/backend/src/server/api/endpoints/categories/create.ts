import { EmojiCustomCategories, DriveFiles } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { HOUR } from "@/const.js";
import { EmojiCustomCategory } from "@/models/entities/emoji-custom-category.js";

export const meta = {
	tags: ["categories"],

	requireCredential: true,

	kind: "write:categories",

	limit: {
		duration: HOUR,
		max: 300,
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "EmojiCustomCategory",
	},

	errors: {
		noSuchFile: {
			message: "そのファイルは存在しません。",
			code: "NO_SUCH_FILE",
			id: "b7b97489-0f66-4b12-a5ff-b21bd63f6e1c",
		},
		nameAlreadyExists: {
			message: "ページ名が重複しています。",
			code: "NAME_ALREADY_EXISTS",
			id: "4650348e-301c-499a-83c9-6aa988c66bc1",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		title: { type: "string" },
		name: { type: "string", minLength: 1 },
		summary: { type: "string", nullable: true },
		contents: {
			type: "array",
			items: {
				type: "string",
			},
		},
		eyeCatchingImageId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
		},
	},
	required: ["title", "name", "contents"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let eyeCatchingImage = null;
	if (ps.eyeCatchingImageId != null) {
		eyeCatchingImage = await DriveFiles.findOneBy({
			id: ps.eyeCatchingImageId,
			userId: user.id,
		});

		if (eyeCatchingImage == null) {
			throw new ApiError(meta.errors.noSuchFile);
		}
	}

	const category = await EmojiCustomCategories.insert(
		new EmojiCustomCategory({
			id: genId(),
			createdAt: new Date(),
			updatedAt: new Date(),
			title: ps.title,
			name: ps.name,
			summary: ps.summary,
			contents: ps.contents,
			eyeCatchingImageId: eyeCatchingImage ? eyeCatchingImage.id : null,
			userId: user.id,
		}),
	).then((x) => EmojiCustomCategories.findOneByOrFail(x.identifiers[0]));

	return await EmojiCustomCategories.pack(category);
});
