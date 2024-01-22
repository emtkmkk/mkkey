import { FollowBlockings } from "@/models/index.js";
import define from "../../define.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "read:mutes",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "FollowBlocking",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
	},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
	const query = makePaginationQuery(
		FollowBlockings.createQueryBuilder("blocking"),
		ps.sinceId,
		ps.untilId,
	).andWhere("blocking.blockerId = :meId", { meId: me.id });

	const blockings = await query.take(ps.limit).getMany();

	return await FollowBlockings.packMany(blockings, me);
});
