/**
 * 管理用・リモート絵文字一覧 API
 *
 * @remarks
 * offset/limit でページング。レスポンスは { items, total }。
 */
import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { toPuny } from "@/misc/convert-host.js";

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
						host: { type: "string", optional: false, nullable: true },
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
		host: {
			type: "string",
			nullable: true,
			default: null,
			description: "ローカルホストは `null` で表します。",
		},
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		offset: { type: "integer", minimum: 0, default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const q = Emojis.createQueryBuilder("emoji");

	if (ps.host == null) {
		q.andWhere("emoji.host IS NOT NULL");
	} else {
		q.andWhere("emoji.host = :host", { host: toPuny(ps.host) });
	}

	if (ps.query != null && ps.query !== "") {
		q.andWhere("emoji.name ILIKE :query", { query: `%${ps.query}%` });
	}

	q.orderBy("emoji.id", "DESC");

	const offset = ps.offset ?? 0;
	const limit = ps.limit ?? 10;
	const [emojis, total] = await q.skip(offset).take(limit).getManyAndCount();

	return {
		items: await Emojis.packMany(emojis),
		total,
	};
});
