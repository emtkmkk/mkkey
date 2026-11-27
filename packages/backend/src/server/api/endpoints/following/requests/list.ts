/**
 * @packageDocumentation
 *
 * 受信したフォローリクエストから、follow範囲ミュート対象を除いて返す。
 *
 * @remarks
 * - **API パス**: `following/requests/list`
 * - 新しい申請から順に、`limit` 件ずつ `sinceId` / `untilId` でページ送りする。
 * - CHANGED: 以前は件数指定もページ送りも無く、全件を返していた。画面の「もっと見る」で
 *   同じ申請が重複して読まれていたため、ほかの一覧 API と同じ形にした。
 *   パラメータを付けずに呼ぶと、新しい方から 10 件だけが返る。
 * - 申請者は、許可するかを判断できるよう詳細版（自己紹介・登録日・フォロー数など）で返す。
 *   詳細版は重いので `limit` の上限を 100 にしている。
 *
 * @internal
 */
import define from "../../../define.js";
import { FollowRequests, Mutings } from "@/models/index.js";
import { createMuteScopeCondition } from "@/misc/mute-scope.js";
import { makePaginationQuery } from "../../../common/make-pagination-query.js";

export const meta = {
	tags: ["following", "account"],

	requireCredential: true,

	kind: "read:following",

	description:
		"自分が受けたフォロー申請を新しい順に返す。sinceId/untilId/limit でページ送りする。申請者は詳細版で返す。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			properties: {
				id: {
					type: "string",
					optional: false,
					nullable: false,
					format: "id",
				},
				createdAt: {
					type: "string",
					optional: false,
					nullable: false,
					format: "date-time",
				},
				follower: {
					type: "object",
					optional: false,
					nullable: false,
					ref: "UserDetailed",
				},
				followee: {
					type: "object",
					optional: false,
					nullable: false,
					ref: "UserLite",
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// 「以降無視」（follow 範囲のミュート）をした相手の申請は出さない
	const followMutingQuery = Mutings.createQueryBuilder("muting")
		.select("muting.muteeId")
		.where("muting.muterId = :muterId", { muterId: user.id })
		.andWhere(createMuteScopeCondition("muting", "follow"));

	const query = makePaginationQuery(
		FollowRequests.createQueryBuilder("request"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere("request.followeeId = :meId", { meId: user.id })
		.andWhere(`request.followerId NOT IN (${followMutingQuery.getQuery()})`)
		.setParameters(followMutingQuery.getParameters());

	const reqs = await query.take(ps.limit).getMany();

	return await Promise.all(
		reqs.map((req) => FollowRequests.pack(req, user, { detailFollower: true })),
	);
});
