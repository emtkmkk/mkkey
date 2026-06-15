/**
 * @packageDocumentation
 *
 * プッシュ通知ミュート一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `push-mute/list`（GET `/api/push-mute/list` で呼び出し）
 * - 認証必須。自分がプッシュ通知ミュートしているユーザーをページネーションで返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { PushMutings } from "@/models/index.js";
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
			ref: "PushMuting",
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
		PushMutings.createQueryBuilder("muting"),
		ps.sinceId,
		ps.untilId,
	).andWhere("muting.muterId = :meId", { meId: me.id });

	const mutings = await query.take(ps.limit).getMany();

	return await PushMutings.packMany(mutings, me);
});
