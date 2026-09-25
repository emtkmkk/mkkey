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
	kind: "read:admin:emoji",
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			items: {
				type: "array",
				items: { type: "object" },
			},
			/** 状態ごとの件数（例：{ pending: 3, rejected: 10 }） */
			counts: { type: "object" },
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

	// 審査画面のタブに状態ごとの件数を出すため、件数もいっしょに返す（追加申請の list と同じ形）
	const [requests, countRows] = await Promise.all([
		q.getMany(),
		EmojiImportRequests.createQueryBuilder("r")
			.select("r.status", "status")
			.addSelect("COUNT(*)", "count")
			.groupBy("r.status")
			.getRawMany<{ status: string; count: string }>(),
	]);
	const counts: Record<string, number> = {};
	for (const row of countRows) counts[row.status] = Number(row.count);

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

	return { items, counts };
});
