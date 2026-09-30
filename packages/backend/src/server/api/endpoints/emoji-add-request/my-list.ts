/**
 * @packageDocumentation
 *
 * 自分の絵文字の追加申請の一覧を返す（ユーザー向け）。
 *
 * @remarks
 * 状態で絞り込める。「修正のお願い中」の申請には、管理者の修正案とコメントも入る（申請者が見比べて再申請するため）。
 *
 * @public
 */
import define from "../../define.js";
import { EmojiAddRequests } from "@/models/index.js";
import { packEmojiAddRequest } from "@/services/emoji-add-request.js";

export const meta = {
	tags: ["emoji-add-request"],
	requireCredential: true,
	kind: "read:account",
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			items: { type: "array", items: { type: "object" } },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		status: {
			type: "string",
			// NB: default: null を付けると、省略時に null が入って enum の検査で 400 になる
			nullable: true,
			enum: ["pending", "changesRequested", "approved", "rejected", "withdrawn"],
		},
		limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
		offset: { type: "integer", minimum: 0, default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const q = EmojiAddRequests.createQueryBuilder("r")
		.where("r.requesterId = :me", { me: me.id })
		.orderBy("r.createdAt", "DESC")
		.skip(ps.offset ?? 0)
		.take(ps.limit ?? 30);
	if (ps.status) q.andWhere("r.status = :status", { status: ps.status });

	const requests = await q.getMany();
	return { items: await Promise.all(requests.map((r) => packEmojiAddRequest(r))) };
});
