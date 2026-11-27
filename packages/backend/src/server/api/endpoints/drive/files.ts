import define from "../../define.js";
import { DriveFiles } from "@/models/index.js";
import { Brackets } from "typeorm";
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
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
		sinceId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より新しいものだけ取得する場合に指定。",
		},
		untilId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より古いものだけ取得する場合に指定。",
		},
		folderId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			default: null,
		},
                type: {
                        type: "string",
                        nullable: true,
                        pattern: /^[0-9a-zA-Z!#$&^_.+\/\-*]+$/.toString().slice(1, -1),
                },
                fromDate: {
                        type: "string",
                        nullable: true,
                },
                untilDate: {
                        type: "string",
                        nullable: true,
                },
                frequentlyUsed: {
                        type: "boolean",
                        default: false,
                },
        },
        required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
        const baseQuery = DriveFiles.createQueryBuilder("file").where(
                "file.userId = :userId",
                { userId: user.id },
        );

        if (ps.frequentlyUsed) {
                baseQuery.andWhere("file.usageCount >= 2");

                if (ps.type) {
                        if (ps.type.endsWith("/*")) {
                                baseQuery.andWhere("file.type like :type", {
                                        type: `${ps.type.replace("/*", "/")}%`,
                                });
                        } else {
                                baseQuery.andWhere("file.type = :type", { type: ps.type });
                        }
                }

                if (ps.fromDate) {
                        const from = new Date(ps.fromDate);
                        if (!Number.isNaN(from.valueOf())) {
                                baseQuery.andWhere("file.createdAt >= :fromDate", {
                                        fromDate: from,
                                });
                        }
                }

                if (ps.untilDate) {
                        const until = new Date(ps.untilDate);
                        if (!Number.isNaN(until.valueOf())) {
                                baseQuery.andWhere("file.createdAt < :untilDate", {
                                        untilDate: until,
                                });
                        }
                }

                if (ps.sinceId) {
                        const sinceFile = await DriveFiles.findOneBy({
                                id: ps.sinceId,
                                userId: user.id,
                        });

                        if (sinceFile) {
                                baseQuery.andWhere(
                                        new Brackets((qb) => {
                                                qb.where("file.usageCount > :sinceUsage", {
                                                        sinceUsage: sinceFile.usageCount,
                                                })
                                                        .orWhere(
                                                                new Brackets((qb2) => {
                                                                        qb2.where(
                                                                                "file.usageCount = :sinceUsage",
                                                                                { sinceUsage: sinceFile.usageCount },
                                                                        )
                                                                                .andWhere(
                                                                                        "file.createdAt > :sinceCreated",
                                                                                        {
                                                                                                sinceCreated:
                                                                                                        sinceFile.createdAt,
                                                                                        },
                                                                                )
                                                                                .orWhere(
                                                                                        new Brackets(
                                                                                                (qb3) => {
                                                                                                        qb3.where(
                                                                                                                "file.usageCount = :sinceUsage",
                                                                                                                {
                                                                                                                        sinceUsage:
                                                                                                                                sinceFile.usageCount,
                                                                                                                },
                                                                                                        )
                                                                                                                .andWhere(
                                                                                                                        "file.createdAt = :sinceCreated",
                                                                                                                        {
                                                                                                                                sinceCreated:
                                                                                                                                        sinceFile.createdAt,
                                                                                                                        },
                                                                                                                )
                                                                                                                .andWhere(
                                                                                                                        "file.id > :sinceId",
                                                                                                                        {
                                                                                                                                sinceId:
                                                                                                                                        ps.sinceId,
                                                                                                                        },
                                                                                                                );
                                                                                                },
                                                                                        ),
                                                                                );
                                                                }),
                                                        );
                                        }),
                                );
                        }
                }

                if (ps.untilId) {
                        const untilFile = await DriveFiles.findOneBy({
                                id: ps.untilId,
                                userId: user.id,
                        });

                        if (untilFile) {
                                baseQuery.andWhere(
                                        new Brackets((qb) => {
                                                qb.where("file.usageCount < :untilUsage", {
                                                        untilUsage: untilFile.usageCount,
                                                })
                                                        .orWhere(
                                                                new Brackets((qb2) => {
                                                                        qb2.where(
                                                                                "file.usageCount = :untilUsage",
                                                                                { untilUsage: untilFile.usageCount },
                                                                        )
                                                                                .andWhere(
                                                                                        "file.createdAt < :untilCreated",
                                                                                        {
                                                                                                untilCreated:
                                                                                                        untilFile.createdAt,
                                                                                        },
                                                                                )
                                                                                .orWhere(
                                                                                        new Brackets(
                                                                                                (qb3) => {
                                                                                                        qb3.where(
                                                                                                                "file.usageCount = :untilUsage",
                                                                                                                {
                                                                                                                        untilUsage:
                                                                                                                                untilFile.usageCount,
                                                                                                                },
                                                                                                        )
                                                                                                                .andWhere(
                                                                                                                        "file.createdAt = :untilCreated",
                                                                                                                        {
                                                                                                                                untilCreated:
                                                                                                                                        untilFile.createdAt,
                                                                                                                        },
                                                                                                                )
                                                                                                                .andWhere(
                                                                                                                        "file.id < :untilId",
                                                                                                                        {
                                                                                                                                untilId:
                                                                                                                                        ps.untilId,
                                                                                                                        },
                                                                                                                );
                                                                                                },
                                                                                        ),
                                                                                );
                                                                }),
                                                        );
                                        }),
                                );
                        }
                }

                baseQuery
                        .orderBy("file.usageCount", "DESC")
                        .addOrderBy("file.createdAt", "DESC")
                        .addOrderBy("file.id", "DESC");

                const files = await baseQuery.take(ps.limit).getMany();
                return await DriveFiles.packMany(files, { detail: false, self: true });
        }

        const query = makePaginationQuery(baseQuery, ps.sinceId, ps.untilId);
        // フォルダを 1 つに決めて絞るか（指定フォルダ、または種類・日付の絞り込みが無いときのルート）
        const folderFixed = !!ps.folderId || (!ps.type && !ps.fromDate && !ps.untilDate);

        if (ps.folderId) {
                query.andWhere("file.folderId = :folderId", { folderId: ps.folderId });
        } else if (folderFixed) {
                query.andWhere("file.folderId IS NULL");
        }

        if (ps.type) {
                if (ps.type.endsWith("/*")) {
                        query.andWhere("file.type like :type", {
                                type: `${ps.type.replace("/*", "/")}%`,
                        });
                } else {
                        query.andWhere("file.type = :type", { type: ps.type });
                }
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

        // untilId / sinceId で送るので、並び順は必ず ID 順にする（sinceId だけのときは古い順）
        const direction = ps.sinceId && !ps.untilId ? "ASC" : "DESC";
        if (folderFixed) {
                // NB: userId・folderId は 1 つの値に決まっているので、先に並べても ID 順と同じになる。
                // 以前からの並べ方をそのまま残している（ルートでは外しても速かったが、
                // ファイルの多いフォルダで主キーを逆順にたどる遅いやり方にならないかは確かめていない）。
                query
                        .orderBy("file.userId", "ASC")
                        .addOrderBy("file.folderId", "ASC")
                        .addOrderBy("file.id", direction);
        } else {
                // HACK: 種類・日付で絞るとき（自動フォルダ）は、ID を文字列の式に変えて並べる。
                // そのまま id で並べると、DB が主キーを逆順にたどる遅いやり方を選ぶ（本番で 17.8 秒、2026-11-27 実測）。
                // 式にすると userId のインデックスで絞ってから並べ替えるようになる（0.04 秒）。並び順は id と同じ。
                // 以前は folderId・type を先に並べてこれを避けていたが、それだと ID 順にならず、
                // 続きの読み込み（untilId）でファイルが抜けたり重複したりしていた。
                query.addSelect("file.id || ''", "file_sort_id").orderBy("file_sort_id", direction);
        }

        const files = await query.take(ps.limit).getMany();

        return await DriveFiles.packMany(files, { detail: false, self: true });
});
