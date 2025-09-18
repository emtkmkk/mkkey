import { DAY } from "@/const.js";
import { GalleryPosts } from "@/models/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["gallery"],

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
			ref: "GalleryPost",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
        const activeThreshold = new Date(Date.now() - 60 * DAY);

        const query = GalleryPosts.createQueryBuilder("post")
                .innerJoinAndSelect("post.user", "user")
                .andWhere("post.likedCount > 0")
                .andWhere("user.isDeleted = false")
                .andWhere(
                        "(user.updatedAt IS NULL OR user.updatedAt >= :activeThreshold)",
                        { activeThreshold },
                )
                .orderBy("post.likedCount", "DESC");

	const posts = await query.take(10).getMany();

	return await GalleryPosts.packMany(posts, me);
});
