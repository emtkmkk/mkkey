/**
 * @packageDocumentation
 *
 * リノートミュート一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `renote-mute/list`（GET `/api/renote-mute/list` で呼び出し）
 * - 認証必須。自分がリノートミュートしているユーザーをページネーションで返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { createMuteScopeCondition } from "@/misc/mute-scope.js";
import { Mutings } from "@/models/index.js";
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
			ref: "RenoteMuting",
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
		Mutings.createQueryBuilder("muting"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere("muting.muterId = :meId", { meId: me.id })
		.andWhere(createMuteScopeCondition("muting", "renote"));

	const mutings = await query.take(ps.limit).getMany();
	const packed = await Mutings.packMany(mutings, me);

	return packed.map((muting) => ({
		id: muting.id,
		createdAt: muting.createdAt,
		muteeId: muting.muteeId,
		mutee: muting.mutee,
	}));
});
