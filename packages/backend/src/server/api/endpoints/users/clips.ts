import { Clips } from "@/models/index.js";
import define from "../../define.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";

export const meta = {
	tags: ["users", "clips"],
	requireCredentialPrivateMode: true,

	description: "指定ユーザーが作成したクリップ一覧を取得します。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "Clip",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: {
			type: "string",
			format: "misskey:id",
			description: "クリップ一覧を取得するユーザーの ID。",
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
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
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const query = makePaginationQuery(
		Clips.createQueryBuilder("clip"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere("clip.userId = :userId", { userId: ps.userId })
		.andWhere("clip.isPublic = true");

	const clips = await query.take(ps.limit).getMany();

	return await Clips.packMany(clips);
});
