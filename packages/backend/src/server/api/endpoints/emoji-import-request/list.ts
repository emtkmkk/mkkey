/**
 * 絵文字インポート申請一覧を取得する（管理者・モデレーター向け）。status でフィルタ可能。
 *
 * @public
 */
import define from "../../define.js";
import { EmojiImportRequests } from "@/models/index.js";

export const meta = {
	tags: ["emoji-import-request", "admin"],
	requireCredential: true,
	requireModerator: true,
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			items: {
				type: "array",
				items: { type: "object" },
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		status: {
			type: "string",
			enum: ["pending", "approved", "rejected"],
			nullable: true,
			default: null,
		},
		limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
		offset: { type: "integer", minimum: 0, default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const q = EmojiImportRequests.createQueryBuilder("r")
		.leftJoinAndSelect("r.requester", "requester")
		.orderBy("r.createdAt", "DESC")
		.skip(ps.offset ?? 0)
		.take(ps.limit ?? 20);

	if (ps.status) {
		q.andWhere("r.status = :status", { status: ps.status });
	}

	const requests = await q.getMany();

	const items = requests.map((r) => ({
		id: r.id,
		emojiName: r.emojiName,
		emojiHost: r.emojiHost,
		requesterId: r.requesterId,
		requester: r.requester
			? {
					id: r.requester.id,
					username: r.requester.username,
					host: r.requester.host,
			  }
			: null,
		status: r.status,
		reason: r.reason,
		processedById: r.processedById,
		importedEmojiId: r.importedEmojiId,
		createdAt: r.createdAt.toISOString(),
		processedAt: r.processedAt?.toISOString() ?? null,
	}));

	return { items };
});
