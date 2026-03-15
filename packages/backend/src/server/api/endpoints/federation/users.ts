import define from "../../define.js";
import { Users } from "@/models/index.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";

export const meta = {
	tags: ["federation"],

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
			ref: "UserDetailedNotMe",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		host: {
			type: "string",
			description: "取得対象のリモートインスタンスのホスト名。",
		},
		sinceId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より新しいユーザーから取得。",
		},
		untilId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より古いユーザーから取得。",
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得件数。",
		},
	},
	required: ["host"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const query = makePaginationQuery(
		Users.createQueryBuilder("user")
			.leftJoinAndSelect("user.avatar", "avatar")
			.leftJoinAndSelect("user.banner", "banner"),
		ps.sinceId,
		ps.untilId,
	).andWhere("user.host = :host", { host: ps.host });

	const users = await query.take(ps.limit).getMany();

	return await Users.packMany(users, me, { detail: true });
});
