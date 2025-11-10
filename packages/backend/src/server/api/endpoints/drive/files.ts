import define from "../../define.js";
import { DriveFiles } from "@/models/index.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";

export const meta = {
	tags: ["drive"],

	requireCredential: true,

	kind: "read:drive",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "DriveFile",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		folderId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			default: null,
		},
                type: {
                        type: "string",
                        nullable: true,
                        pattern: /^[a-zA-Z\/\-*]+$/.toString().slice(1, -1),
                },
                fromDate: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                },
                untilDate: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                },
        },
        required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const query = makePaginationQuery(
		DriveFiles.createQueryBuilder("file"),
		ps.sinceId,
		ps.untilId,
	).andWhere("file.userId = :userId", { userId: user.id });
	query.orderBy("file.userId", "ASC");

	if (ps.folderId) {
		query.andWhere("file.folderId = :folderId", { folderId: ps.folderId });
	} else {
		query.andWhere("file.folderId IS NULL");
        }
        query.addOrderBy("file.folderId", "ASC");

        if (ps.type) {
                if (ps.type.endsWith("/*")) {
			query.andWhere("file.type like :type", {
				type: `${ps.type.replace("/*", "/")}%`,
			});
		} else {
			query.andWhere("file.type = :type", { type: ps.type });
                }
                query.addOrderBy("file.type", "ASC");
        }

        if (ps.fromDate) {
                const from = new Date(ps.fromDate);
                if (!Number.isNaN(from.valueOf())) {
                        query.andWhere("file.createdAt >= :fromDate", {
                                fromDate: from,
                        });
                }
        }

        if (ps.untilDate) {
                const until = new Date(ps.untilDate);
                if (!Number.isNaN(until.valueOf())) {
                        query.andWhere("file.createdAt < :untilDate", {
                                untilDate: until,
                        });
                }
        }
        query.addOrderBy("file.id", "DESC");

	const files = await query.take(ps.limit).getMany();

	return await DriveFiles.packMany(files, { detail: false, self: true });
});
