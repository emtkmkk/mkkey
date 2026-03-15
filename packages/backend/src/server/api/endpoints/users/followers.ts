import { IsNull } from "typeorm";
import { Users, Followings, UserProfiles } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import { toPunyNullable } from "@/misc/convert-host.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "指定ユーザーをフォローしているユーザー一覧を取得します。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "Following",
		},
	},

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "27fa5435-88ab-43de-9360-387de88727cd",
		},

		forbidden: {
			message: "禁止されています。",
			code: "FORBIDDEN",
			id: "3c6a84db-d619-26af-ca14-06232a21df8a",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		sinceId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より新しいものだけ取得する場合に指定。",
		},
		untilId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より古いものだけ取得する場合に指定。",
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
	},
	anyOf: [
		{
			properties: {
				userId: {
					type: "string",
					format: "misskey:id",
					description: "フォロワー一覧を取得するユーザーの ID。",
				},
			},
			required: ["userId"],
		},
		{
			properties: {
				username: { type: "string" },
				host: {
					type: "string",
					nullable: true,
					description: "ローカルホストは `null` で表します。",
				},
			},
			required: ["username", "host"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy(
		ps.userId != null
			? { id: ps.userId }
			: {
					usernameLower: ps.username!.toLowerCase(),
					host: toPunyNullable(ps.host) ?? IsNull(),
			  },
	);

	if (user == null || (user.host && !me?.isAdmin)) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	if (!me?.isAdmin) {
		if (profile.ffVisibility === "private") {
			if (me == null || me.id !== user.id) {
				throw new ApiError(meta.errors.forbidden);
			}
		} else if (profile.ffVisibility === "followers") {
			if (me == null) {
				throw new ApiError(meta.errors.forbidden);
			} else if (me.id !== user.id) {
				const following = await Followings.findOneBy({
					followeeId: user.id,
					followerId: me.id,
				});
				if (following == null) {
					throw new ApiError(meta.errors.forbidden);
				}
			}
		}
	}

	const query = makePaginationQuery(
		Followings.createQueryBuilder("following"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere("following.followeeId = :userId", { userId: user.id })
		.innerJoinAndSelect("following.follower", "follower")
		.leftJoinAndSelect("follower.avatar", "followerAvatar")
		.leftJoinAndSelect("follower.banner", "followerBanner");

	const followings = await query.take(ps.limit).getMany();

	const userMap = new Map<User["id"], User>();
	for (const f of followings) {
		if (f.follower) userMap.set(f.follower.id, f.follower);
	}

	return await Followings.packMany(followings, me, {
		populateFollower: true,
		_hint_: { userMap },
	});
});
