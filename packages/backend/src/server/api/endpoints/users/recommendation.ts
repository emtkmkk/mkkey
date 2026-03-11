import { Users } from "@/models/index.js";
import define from "../../define.js";
import { generateMutedUserQueryForUsers } from "../../common/generate-muted-user-query.js";
import {
        generateBlockedUserQuery,
        generateBlockQueryForUsers,
} from "../../common/generate-block-query.js";
import { DAY } from "@/const.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";

export const meta = {
	tags: ["users"],

	requireCredential: true,

	kind: "read:account",

	description:
		"Show users that the authenticated user might be interested to follow.",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "UserDetailed",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		offset: { type: "integer", default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const query = Users.createQueryBuilder("user")
		.leftJoinAndSelect("user.avatar", "avatar")
		.leftJoinAndSelect("user.banner", "banner")
		.where("user.isLocked = FALSE")
		.andWhere("user.isExplorable = TRUE")
		.andWhere("user.host IS NULL")
		.andWhere("user.updatedAt >= :date", {
			date: new Date(Date.now() - 7 * DAY),
		})
		.andWhere("user.id != :meId", { meId: me.id })
		.orderBy("user.followersCount", "DESC");

	generateMutedUserQueryForUsers(query, me);
	generateBlockQueryForUsers(query, me);
	generateBlockedUserQuery(query, me);

        const followingCondition = createFollowingExistsCondition(me.id);

        query.andWhere(`NOT ${followingCondition.clause("user.id")}`);

        query.setParameters(followingCondition.parameters);

	const users = await query.take(ps.limit).skip(ps.offset).getMany();

	return await Users.packMany(users, me, { detail: true });
});
