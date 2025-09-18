import { DAY } from "@/const.js";
import { GalleryPosts } from "@/models/index.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import define from "../../define.js";

export const meta = {
	tags: ["gallery"],
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
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
        const activeThreshold = new Date(Date.now() - 60 * DAY);

        const query = makePaginationQuery(
                GalleryPosts.createQueryBuilder("post"),
                ps.sinceId,
                ps.untilId,
        )
                .innerJoinAndSelect("post.user", "user")
                .andWhere("user.isDeleted = false")
                .andWhere(
                        "(user.updatedAt IS NULL OR user.updatedAt >= :activeThreshold)",
                        { activeThreshold },
                );

        const posts = await query.take(ps.limit).getMany();

	return await GalleryPosts.packMany(posts, me);
});
