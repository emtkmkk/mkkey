import { Brackets } from "typeorm";
import { Users } from "@/models/index.js";
import { USER_ACTIVE_THRESHOLD } from "@/const.js";
import type { User } from "@/models/entities/user.js";
import define from "../../define.js";
import config from "@/config/index.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "Search for a user by username and/or host.",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "User",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		username: { type: "string", nullable: true },
		host: { type: "string", nullable: true },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		detail: { type: "boolean", default: true },
	},
	anyOf: [{ required: ["username"] }, { required: ["host"] }],
} as const;

// : avatar,bannerをJOINしたいけどエラーになる

export default define(meta, paramDef, async (ps, me) => {
	const activeThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30日

	if (ps.username || ps.host) {
		let users: User[] = [];

		if (me) {
                        const followingCondition = createFollowingExistsCondition(me.id);

                        const query = Users.createQueryBuilder("user");
                                query.where(followingCondition.clause("user.id"))
                                query.andWhere("user.id != :meId", { meId: me.id })
                                query.andWhere("user.isSuspended = FALSE")
				if (ps.host) {
					query.andWhere("coalesce(user.host, :url) LIKE :host", {
						url: config.host,
						host: `${ps.host === "." ? config.host : ps.host.toLowerCase()}%`,
					});
				}
				if (ps.username) {
					query.andWhere("user.usernameLower LIKE :username", {
						username: `${ps.username.toLowerCase()}%`,
					});
				}
				if (!ps.username || !ps.host) {
					query.andWhere(
						new Brackets((qb) => {
							qb.where(
								"user.lastActiveDate > :activeThreshold",
								{ activeThreshold: activeThreshold },
							);
						}),
					);
				}

                        query.setParameters(followingCondition.parameters);

			users = await query
				.orderBy("user.usernameLower", "ASC")
				.take(ps.limit)
				.getMany();

			if (users.length < ps.limit) {
                                const otherQuery = Users.createQueryBuilder("user")
                                        .where(`NOT ${followingCondition.clause("user.id")}`)
					.andWhere("user.id != :meId", { meId: me.id })
					.andWhere("user.isSuspended = FALSE")
					if (ps.host) {
						otherQuery.andWhere("coalesce(user.host, :url) LIKE :host", {
							url: config.host,
							host: `${ps.host === "." ? config.host : ps.host.toLowerCase()}%`,
						});
					}
					if (ps.username) {
						otherQuery.andWhere("user.usernameLower LIKE :username", {
							username: `${ps.username.toLowerCase()}%`,
						});
					}

                                otherQuery.setParameters(followingCondition.parameters);

				const otherUsers = await otherQuery
					.orderBy("user.usernameLower", "ASC")
					.take(ps.limit - users.length)
					.getMany();

				users = users.concat(otherUsers);
			}
		} else {
			const query = Users.createQueryBuilder("user")
				.where("user.isSuspended = FALSE")
				if (ps.host) {
					query.andWhere("coalesce(user.host, :url) LIKE :host", {
						url: config.host,
						host: `${ps.host === "." ? config.host : ps.host.toLowerCase()}%`,
					});
				}
				if (ps.username) {
					query.andWhere("user.usernameLower LIKE :username", {
						username: `${ps.username.toLowerCase()}%`,
					});
				}
				query.andWhere("user.updatedAt IS NOT NULL")
				users = await query.orderBy("user.usernameLower", "ASC")
				.take(ps.limit - users.length)
				.getMany();
		}

		return await Users.packMany(users, me, { detail: !!ps.detail });
	}

	return [];
});
