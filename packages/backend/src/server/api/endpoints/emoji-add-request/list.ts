/**
 * @packageDocumentation
 *
 * 絵文字の追加申請の一覧を返す（管理者・モデレーター向けの審査画面）。
 *
 * @remarks
 * 状態で絞り込める。審査待ちは古い順（先に来たものから審査する）、それ以外は新しい順に並べる。
 * 状態ごとの件数も返す（審査画面の切り替えに件数を出すため）。
 *
 * @public
 */
import define from "../../define.js";
import { EmojiAddRequests } from "@/models/index.js";
import { packEmojiAddRequest } from "@/services/emoji-add-request.js";

export const meta = {
	tags: ["emoji-add-request", "admin"],
	requireCredential: true,
	requireModerator: true,
	kind: "read:admin:emoji",
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			items: { type: "array", items: { type: "object" } },
			counts: { type: "object" },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		status: {
			type: "string",
			nullable: true,
			default: null,
			enum: ["pending", "changesRequested", "approved", "rejected", "withdrawn"],
		},
		limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
		offset: { type: "integer", minimum: 0, default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const q = EmojiAddRequests.createQueryBuilder("r")
		.leftJoinAndSelect("r.requester", "requester")
		.orderBy("r.createdAt", ps.status === "pending" ? "ASC" : "DESC")
		.skip(ps.offset ?? 0)
		.take(ps.limit ?? 30);
	if (ps.status) q.andWhere("r.status = :status", { status: ps.status });

	const [requests, countRows] = await Promise.all([
		q.getMany(),
		EmojiAddRequests.createQueryBuilder("r")
			.select("r.status", "status")
			.addSelect("COUNT(*)", "count")
			.groupBy("r.status")
			.getRawMany<{ status: string; count: string }>(),
	]);

	const counts: Record<string, number> = {};
	for (const row of countRows) counts[row.status] = Number(row.count);

	return {
		items: await Promise.all(requests.map((r) => packEmojiAddRequest(r))),
		counts,
	};
});
