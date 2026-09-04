/**
 * 管理用絵文字一覧 API
 *
 * @remarks
 * offset/limit によるページング。検索・並び替え・特殊フィルタ（未タグ/未ライセンス/未カテゴリ）を DB 側で実施。
 * レスポンスは { items, total }。noLicense はライセンス関係項目がすべて未設定のものに限定。
 */
import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { Brackets } from "typeorm";

const SORT_COLUMNS = ["id", "name", "createdAt", "updatedAt"] as const;
const SORT_ORDER_DEFAULT = "DESC";
const SORT_COLUMN_DEFAULT = "id";

export const meta = {
	tags: ["admin"],

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
				optional: false,
				nullable: false,
				items: {
					type: "object",
					optional: false,
					nullable: false,
					properties: {
						id: { type: "string", optional: false, nullable: false, format: "id" },
						aliases: {
							type: "array",
							optional: false,
							nullable: false,
							items: { type: "string", optional: false, nullable: false },
						},
						name: { type: "string", optional: false, nullable: false },
						category: { type: "string", optional: false, nullable: true },
						host: {
							type: "null",
							optional: false,
							description:
								"The local host is represented with `null`. The field exists for compatibility with other API endpoints that return files.",
						},
						url: { type: "string", optional: false, nullable: false },
						license: { type: "string", optional: false, nullable: true },
					},
				},
			},
			total: { type: "integer", optional: false, nullable: false },
		},
		required: ["items", "total"],
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		query: { type: "string", nullable: true, default: null },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		offset: { type: "integer", minimum: 0, default: 0 },
		sort: {
			type: "string",
			nullable: true,
			default: null,
			description: "並び順。+name / -name / +updatedAt / -updatedAt / +createdAt / -createdAt / +id / -id。省略時は -id。",
		},
		noTag: { type: "boolean", default: false, description: "未タグ（aliases が空）のみ" },
		noLicense: {
			type: "boolean",
			default: false,
			description: "ライセンス関係項目がすべて未設定のもののみ",
		},
		noCategory: { type: "boolean", default: false, description: "未カテゴリのみ" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const q = Emojis.createQueryBuilder("emoji").where("emoji.host IS NULL");

	if (ps.query != null && ps.query !== "") {
		const pattern = `%${ps.query}%`;
		q.andWhere(
			new Brackets((qb) => {
				qb.where("emoji.name ILIKE :pattern", { pattern })
					.orWhere("emoji.category ILIKE :pattern", { pattern })
					.orWhere("emoji.license ILIKE :pattern", { pattern })
					.orWhere(
						"EXISTS (SELECT 1 FROM unnest(emoji.aliases) AS a WHERE a ILIKE :pattern)",
						{ pattern },
					);
			}),
		);
	}

	if (ps.noTag) {
		q.andWhere("(emoji.aliases = '{}' OR array_length(emoji.aliases, 1) IS NULL)");
	}

	if (ps.noCategory) {
		q.andWhere("(emoji.category IS NULL OR emoji.category = '')");
	}

	if (ps.noLicense) {
		q.andWhere("(emoji.license IS NULL OR emoji.license = '')")
			.andWhere("(emoji.copyPermission IS NULL OR emoji.copyPermission = '')")
			.andWhere("(emoji.licenseName IS NULL OR emoji.licenseName = '')")
			.andWhere("(emoji.usageInfo IS NULL OR emoji.usageInfo = '')")
			.andWhere("(emoji.creator IS NULL OR emoji.creator = '')")
			.andWhere("(emoji.description IS NULL OR emoji.description = '')")
			.andWhere("(emoji.isBasedOnUrl IS NULL OR emoji.isBasedOnUrl = '')");
	}

	const sortRaw = ps.sort ?? `-${SORT_COLUMN_DEFAULT}`;
	const order = sortRaw.startsWith("+") ? "ASC" : "DESC";
	const col = sortRaw.slice(1) || SORT_COLUMN_DEFAULT;
	const column = SORT_COLUMNS.includes(col as (typeof SORT_COLUMNS)[number])
		? `emoji.${col}`
		: "emoji.id";
	q.orderBy(column, order as "ASC" | "DESC");

	const offset = ps.offset ?? 0;
	const limit = ps.limit ?? 10;
	const [emojis, total] = await q.skip(offset).take(limit).getManyAndCount();

	return {
		items: await Emojis.packMany(emojis),
		total,
	};
});
