import { IsNull } from "typeorm";
import define from "../../define.js";
import { Users, UserSupports } from "@/models/index.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "read:admin:support",

	description:
		"支援実績を取得する。month を指定するとその月の一覧、username を指定するとそのユーザーの履歴。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		month: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
		username: { type: "string" },
		limit: { type: "integer", minimum: 1, maximum: 500, default: 200 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	if (ps.month == null && ps.username == null) {
		throw new Error("month or username is required");
	}

	const query = UserSupports.createQueryBuilder("s")
		.innerJoin("user", "u", '"u"."id" = "s"."userId"')
		.addSelect('"u"."username"', "username")
		.orderBy('"s"."month"', "DESC")
		.addOrderBy('"s"."appliedAt"', "DESC")
		.limit(ps.limit);

	if (ps.month != null) {
		query.andWhere('"s"."month" = :month', { month: ps.month });
	}

	if (ps.username != null) {
		const user = await Users.findOneBy({
			usernameLower: ps.username.toLowerCase(),
			host: IsNull(),
		});
		if (user == null) throw new Error("user not found");
		query.andWhere('"s"."userId" = :userId', { userId: user.id });
	}

	const { entities, raw } = await query.getRawAndEntities();

	return entities.map((s, i) => ({
		id: s.id,
		userId: s.userId,
		username: raw[i]?.username ?? null,
		month: s.month,
		source: s.source,
		externalId: s.externalId,
		plans: s.plans,
		grantMb: s.grantMb,
		months: s.months,
		beforeMb: s.beforeMb,
		afterMb: s.afterMb,
		appliedAt: s.appliedAt,
		appliedById: s.appliedById,
	}));
});
