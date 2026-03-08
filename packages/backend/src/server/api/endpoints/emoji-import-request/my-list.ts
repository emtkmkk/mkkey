/**
 * 自分の絵文字インポート申請一覧を取得する（pending / rejected / approved を分けて返す）。
 *
 * @public
 */
import define from "../../define.js";
import { EmojiImportRequests } from "@/models/index.js";

export const meta = {
	tags: ["emoji-import-request"],
	requireCredential: true,
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			pending: {
				type: "array",
				items: { type: "object" },
			},
			rejected: {
				type: "array",
				items: { type: "object" },
			},
			approved: {
				type: "array",
				items: { type: "object" },
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const [pending, rejected, approved] = await Promise.all([
		EmojiImportRequests.find({
			where: { requesterId: me.id, status: "pending" },
			order: { createdAt: "DESC" },
		}),
		EmojiImportRequests.find({
			where: { requesterId: me.id, status: "rejected" },
			order: { processedAt: "DESC" },
		}),
		EmojiImportRequests.find({
			where: { requesterId: me.id, status: "approved" },
			order: { processedAt: "DESC" },
		}),
	]);

	return {
		pending: pending.map((r) => ({
			id: r.id,
			emojiName: r.emojiName,
			emojiHost: r.emojiHost,
			status: r.status,
			createdAt: r.createdAt.toISOString(),
		})),
		rejected: rejected.map((r) => ({
			id: r.id,
			emojiName: r.emojiName,
			emojiHost: r.emojiHost,
			status: r.status,
			reason: r.reason,
			processedAt: r.processedAt?.toISOString() ?? null,
			createdAt: r.createdAt.toISOString(),
		})),
		approved: approved.map((r) => ({
			id: r.id,
			emojiName: r.emojiName,
			emojiHost: r.emojiHost,
			status: r.status,
			importedEmojiId: r.importedEmojiId,
			processedAt: r.processedAt?.toISOString() ?? null,
			createdAt: r.createdAt.toISOString(),
		})),
	};
});
