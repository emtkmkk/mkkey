import { DAY } from "@/const.js";
import { Pages } from "@/models/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["pages"],

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
			ref: "Page",
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
        const activeThreshold = new Date(Date.now() - 60 * DAY);

        const query = Pages.createQueryBuilder("page")
                .innerJoinAndSelect("page.user", "user")
                .where("page.visibility = 'public'")
                .andWhere("page.isPublic = true")
                .andWhere("user.isDeleted = false")
                .andWhere(
                        "(user.updatedAt IS NULL OR user.updatedAt >= :activeThreshold)",
                        { activeThreshold },
                )
                .andWhere("(page.likedCount * 10) + page.userPv > 0")
                .orderBy("(page.likedCount * 10) + page.userPv", "DESC");

        const pages = await query.take(ps.limit || 10).getMany();

        return await Pages.packMany(pages, me);
});
