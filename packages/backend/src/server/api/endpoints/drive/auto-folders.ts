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
                },
        },
} as const;

export const paramDef = {
        type: "object",
        properties: {
                type: {
                        type: "string",
                        nullable: true,
                        pattern: /^[a-zA-Z\/\-*]+$/.toString().slice(1, -1),
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
                const year = monthDate.getUTCFullYear();
                const month = monthDate.getUTCMonth();
                const from = new Date(Date.UTC(year, month, 1));
                const until = new Date(Date.UTC(year, month + 1, 1));

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
                        .select("split_part(file.type, '/', 1)", "major")
                        .addSelect("COUNT(*)", "count")
                        .where("file.userId = :userId", { userId: user.id })
        )
                .groupBy("major")
                .orderBy("count", "DESC")
                .getRawMany();

        const types = typesRaw
                .filter((row: { major: string | null }) => row.major)
                .map((row: { major: string; count: string }) => {
                        const majorType = row.major;
                        const type =
                                ps.type && !ps.type.endsWith("/*")
                                        ? ps.type
                                        : `${majorType}/*`;
                        return {
                                majorType,
                                type,
                                count: Number(row.count),
                        };
                });

        return {
                months,
                types,
        };
});
