import { db } from "@/db/postgre.js";
import type { Packed } from "@/misc/schema.js";
import { awaitAll } from "@/prelude/await-all.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { User } from "@/models/entities/user.js";
import { Users, DriveFiles, PageLikes } from "../index.js";
import { EmojiCustomCategory } from "../entities/emoji-custom-category.js";

export const EmojiCustomCategoryRepository = db.getRepository(EmojiCustomCategory).extend({
	async pack(
		src: EmojiCustomCategory["id"] | EmojiCustomCategory,
		me?: { id: User["id"] } | null | undefined,
	): Promise<Packed<"EmojiCustomCategory">> {
		const meId = me ? me.id : null;
		const category =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		return await awaitAll({
			id: category.id,
			createdAt: category.createdAt.toISOString(),
			updatedAt: category.updatedAt.toISOString(),
			userId: category.userId,
			user: Users.pack(category.user || category.userId, me),
			content: category.contents,
			title: category.title,
			name: category.name,
			summary: category.summary,
			eyeCatchingImageId: category.eyeCatchingImageId,
			eyeCatchingImage: category.eyeCatchingImageId
				? await DriveFiles.pack(category.eyeCatchingImageId)
				: null,
		});
	},

	packMany(EmojiCustomCategories: EmojiCustomCategory[], me?: { id: User["id"] } | null | undefined) {
		return Promise.all(EmojiCustomCategories.map((x) => this.pack(x, me)));
	},
});
