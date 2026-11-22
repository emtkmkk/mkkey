/**
 * 絵文字インポート申請一覧を取得する（管理者・モデレーター向け）。status でフィルタ可能。
 *
 * @remarks
 * 審査のときに一覧で判断できるよう、申請された元の絵文字のライセンス（`source`）も付けて返す。
 * 元の絵文字が掃除などで消えている場合は `source: null`。
 * `source.copyDenied` が true の申請は承認できない（approve が copyDenied で断る）。
 *
 * @public
 */
import { In } from "typeorm";
import define from "../../define.js";
import { EmojiImportRequests, Emojis } from "@/models/index.js";
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import { isRemoteEmojiCopyDenied } from "@/misc/emoji-copy-policy.js";

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
			// NB: default: null を付けると、省略時に null が入って enum の検査で 400 になる
			nullable: true,
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

	// 申請された元の絵文字を 1 回のクエリでまとめて引く（名前で絞り、ホストは後で照合する）
	const sourceEmojis =
		requests.length > 0
			? await Emojis.find({
					select: ["name", "host", "copyPermission", "licenseName"],
					where: { name: In([...new Set(requests.map((r) => r.emojiName))]) },
			  })
			: [];
	const sourceByKey = new Map(
		sourceEmojis.map((e) => [`${e.name}@${e.host ?? ""}`, e]),
	);

	const items = requests.map((r) => {
		const source = sourceByKey.get(`${r.emojiName}@${r.emojiHost}`);
		return {
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
			source: source
				? {
						copyPermission: fromStoredCopyPermission(source.copyPermission),
						licenseName: source.licenseName ?? null,
						copyDenied: isRemoteEmojiCopyDenied(source),
				  }
				: null,
		};
	});

	return { items, counts };
});
