import define from "../../define.js";
import { DriveFiles } from "@/models/index.js";
import type { SelectQueryBuilder } from "typeorm";
import { DriveFile } from "@/models/entities/drive-file.js";

export const meta = {
        tags: ["drive"],
        requireCredential: true,
        kind: "read:drive",
        res: {
                type: "object",
                optional: false,
                nullable: false,
                properties: {
                        months: {
                                type: "array",
                                items: {
                                        type: "object",
                                        properties: {
                                                year: { type: "integer" },
                                                month: { type: "integer" },
                                                from: { type: "string" },
                                                until: { type: "string" },
                                                count: { type: "integer" },
                                        },
                                        required: ["year", "month", "from", "until", "count"],
                                },
                                default: [],
                        },
                        types: {
                                type: "array",
                                items: {
                                        type: "object",
                                        properties: {
                                                majorType: { type: "string" },
                                                type: { type: "string", nullable: true },
                                                count: { type: "integer" },
                                        },
                                        required: ["majorType", "count"],
                                },
                                default: [],
                        },
                        frequentlyUsed: {
                                type: "object",
                                nullable: true,
                                optional: true,
                                properties: {
                                        count: { type: "integer" },
                                },
                                required: ["count"],
                        },
                },
        },
} as const;

export const paramDef = {
        type: "object",
        properties: {
                type: {
                        type: "string",
                        nullable: true,
                        pattern: /^[0-9a-zA-Z!#$&^_.+\/\-*]+$/.toString().slice(1, -1),
                },
        },
        required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
        const applyTypeFilter = (query: SelectQueryBuilder<DriveFile>) => {
                if (!ps.type) return query;

                if (ps.type.endsWith("/*")) {
                        query.andWhere("file.type like :type", {
                                type: `${ps.type.replace("/*", "/")}%`,
                        });
                } else {
                        query.andWhere("file.type = :type", { type: ps.type });
                }

                return query;
        };

        const monthsRaw = await applyTypeFilter(
                DriveFiles.createQueryBuilder("file")
                        .select("date_trunc('month', file.createdAt)", "month")
                        .addSelect("COUNT(*)", "count")
                        .where("file.userId = :userId", { userId: user.id })
        )
                .groupBy("month")
                .orderBy("month", "DESC")
                .getRawMany();

        const months = monthsRaw.map((row: { month: string; count: string }) => {
                const monthDate = new Date(row.month);
                const year = monthDate.getFullYear();
                const month = monthDate.getMonth();
                const from = new Date(year, month, 1);
                const until = new Date(year, month + 1, 1);

                return {
                        year,
                        month: month + 1,
                        from: from.toISOString(),
                        until: until.toISOString(),
                        count: Number(row.count),
                };
        });

        const typesRaw = await applyTypeFilter(
                DriveFiles.createQueryBuilder("file")
                        .select("file.type", "type")
                        .addSelect("split_part(file.type, '/', 1)", "major")
                        .addSelect("COUNT(*)", "count")
                        .where("file.userId = :userId", { userId: user.id })
        )
                .groupBy("type")
                .addGroupBy("major")
                .orderBy("count", "DESC")
                .getRawMany();

        const types = typesRaw
                .filter((row: { type: string | null }) => row.type)
                .map((row: { type: string; major: string | null; count: string }) => ({
                        majorType: row.major ?? row.type.split("/")[0],
                        type: row.type,
                        count: Number(row.count),
                }));

        const maxUsageRow = await applyTypeFilter(
                DriveFiles.createQueryBuilder("file")
                        .select("MAX(file.usageCount)", "max")
                        .where("file.userId = :userId", { userId: user.id }),
        ).getRawOne<{ max: string | null }>();

        let frequentlyUsed: { count: number } | null = null;

        if ((maxUsageRow?.max ? Number(maxUsageRow.max) : 0) > 4) {
                const frequentCountRow = await applyTypeFilter(
                        DriveFiles.createQueryBuilder("file")
                                .select("COUNT(*)", "count")
                                .where("file.userId = :userId", { userId: user.id })
                                .andWhere("file.usageCount >= 2"),
                ).getRawOne<{ count: string }>();

                frequentlyUsed = {
                        count: Number(frequentCountRow?.count ?? 0),
                };
        }

        return {
                months,
                types,
                frequentlyUsed,
        };
});
