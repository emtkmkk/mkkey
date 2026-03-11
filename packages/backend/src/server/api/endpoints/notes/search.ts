import { In, Brackets } from "typeorm";
import { Followings, Notes } from "@/models/index.js";
import { Note } from "@/models/entities/note.js";
import config from "@/config/index.js";
import es from "../../../../db/elasticsearch.js";
import sonic from "../../../../db/sonic.js";
import define from "../../define.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { genId } from "@/misc/gen-id.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";

export const meta = {
	tags: ["notes"],

	requireCredential: true,
	requireCredentialPrivateMode: true,

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "Note",
		},
	},

	errors: {},
} as const;

export const paramDef = {
        type: "object",
        properties: {
                query: { type: "string" },
                sinceId: { type: "string", format: "misskey:id" },
                untilId: { type: "string", format: "misskey:id" },
                limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
                offset: { type: "integer", default: 0 },
                host: {
                        type: "string",
                        nullable: true,
                        description: "The local host is represented with `null`.",
                },
                userId: {
                        type: "string",
                        format: "misskey:id",
                        nullable: true,
                        default: null,
                },
                channelId: {
                        type: "string",
                        format: "misskey:id",
                        nullable: true,
                        default: null,
                },
                visibility: {
                        type: "string",
                        nullable: true,
                        default: null,
                },
                local: {
                        type: "boolean",
                        nullable: true,
                        default: null,
                },
                minScore: {
                        type: "integer",
                        nullable: true,
                        default: null,
                },
                excludeUserIds: {
                        type: "array",
                        items: {
                                type: "string",
                                format: "misskey:id",
                        },
                        nullable: true,
                        default: [],
                },
        },
        required: ["query"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
        const tokens = ps.query.split(/[\s\+]+/).filter((token) => token.length > 0);

        let userId = ps.userId ?? null;
        let channelId = ps.channelId ?? null;
        let host = ps.host ?? undefined;
        let visibility = ps.visibility ?? null;
        let localOnly = ps.local === true ? true : null;
        let minScore = ps.minScore ?? null;
        let sinceDate: Date | null = null;
        let untilDate: Date | null = null;

        const filters: string[] = [];
        const includeWords: string[] = [];
        const excludeWords: string[] = [];
        const excludeUserIdsFromQuery: string[] = [];

        for (const rawToken of tokens) {
                const token = rawToken.trim();
                if (token.length === 0) continue;

                const lowerToken = token.toLowerCase();

                if (lowerToken === "from:me") {
                        if (me) {
                                userId = me.id;
                        }
                        continue;
                }

                if (lowerToken.startsWith("-user:")) {
                        const value = token.substring(token.indexOf(":") + 1);
                        if (value) excludeUserIdsFromQuery.push(value);
                        continue;
                }

                if (token.startsWith("-")) {
                        if (token.length > 1) excludeWords.push(token.substring(1));
                        continue;
                }

                const colonIndex = token.indexOf(":");
                if (colonIndex === -1) {
                        includeWords.push(token);
                        continue;
                }

                const key = token.substring(0, colonIndex).toLowerCase();
                const value = token.substring(colonIndex + 1);

                switch (key) {
                        case "user":
                                if (value) userId = value;
                                break;
                        case "channel":
                                if (value) channelId = value;
                                break;
                        case "host":
                                if (value === "." || value === "" || value.toLowerCase() === "null") {
                                        host = null;
                                } else {
                                        host = value;
                                }
                                break;
                        case "visibility":
                                if (value) visibility = value;
                                break;
                        case "local":
                                if (value) {
                                        const lowered = value.toLowerCase();
                                        localOnly = ["true", "on", "yes", "only", "1"].includes(lowered)
                                                ? true
                                                : localOnly;
                                }
                                break;
                        case "score": {
                                const parsed = Number(value);
                                if (!Number.isNaN(parsed)) {
                                        minScore = parsed;
                                }
                                break;
                        }
                        case "filter":
                                if (value) filters.push(value.toLowerCase());
                                break;
                        case "until": {
                                const parsed = new Date(value);
                                if (!Number.isNaN(parsed.valueOf())) {
                                        untilDate = parsed;
                                }
                                break;
                        }
                        case "since": {
                                const parsed = new Date(value);
                                if (!Number.isNaN(parsed.valueOf())) {
                                        sinceDate = parsed;
                                }
                                break;
                        }
                        default:
                                includeWords.push(token);
                                break;
                }
        }

        const excludeUserIds = Array.from(
                new Set([...(ps.excludeUserIds ?? []), ...excludeUserIdsFromQuery]),
        ).filter((id) => !!id);

        const loweredIncludeWords = includeWords.map((word) => word.toLowerCase());
        const loweredExcludeWords = excludeWords.map((word) => word.toLowerCase());

        const hasSearchCondition =
                includeWords.length > 0 ||
                excludeWords.length > 0 ||
                filters.length > 0 ||
                excludeUserIds.length > 0 ||
                userId != null ||
                channelId != null ||
                host !== undefined ||
                visibility != null ||
                localOnly === true ||
                minScore != null ||
                sinceDate != null ||
                untilDate != null;

        if (!hasSearchCondition) {
                return [];
        }

        const normalizeVisibility = (value: string | null) => {
                if (value == null) return null;
                switch (value) {
                        case "サークル":
                        case "circle":
                                return "circle";
                        case "全公開":
                                return "public";
                        case "ホーム":
                                return "home";
                        case "フォロワー":
                                return "followers";
                        case "ダイレクト":
                        case "direct":
                                return "specified";
                        default:
                                return value;
                }
        };

        const normalizedVisibility = normalizeVisibility(visibility);
        const circleVisibility = normalizedVisibility === "circle";
        const untilId = untilDate ? genId(untilDate) : null;
        const sinceId = sinceDate ? genId(sinceDate) : null;

        const createNoteMatcher = (followeeIds: Set<string> | null) => {
                return (note: Note): boolean => {
                        if (userId && note.userId !== userId) return false;
                        if (excludeUserIds.includes(note.userId)) return false;
                        if (channelId && note.channelId !== channelId) return false;
                        if (host !== undefined) {
                                if (host === null || host === config.host) {
                                        if (note.userHost != null) return false;
                                } else if (note.userHost !== host) {
                                        return false;
                                }
                        }
                        if (normalizedVisibility) {
                                if (circleVisibility) {
                                        if (note.visibility !== "specified") return false;
                                        if (!note.ccUserIds || note.ccUserIds.length === 0) return false;
                                } else if (note.visibility !== normalizedVisibility) {
                                        return false;
                                }
                        }
                        if (localOnly && !note.localOnly) return false;
                        if (minScore != null && !(note.score > minScore)) return false;
                        if (sinceId && note.id <= sinceId) return false;
                        if (untilId && note.id >= untilId) return false;
                        if (ps.sinceId && note.id <= ps.sinceId) return false;
                        if (ps.untilId && note.id >= ps.untilId) return false;

                        const cwLower = note.cw?.toLowerCase() ?? "";
                        const textLower = note.text?.toLowerCase() ?? "";

                        for (const word of loweredIncludeWords) {
                                if (!cwLower.includes(word) && !textLower.includes(word)) {
                                        return false;
                                }
                        }

                        for (const word of loweredExcludeWords) {
                                if ((note.cw != null && cwLower.includes(word)) || textLower.includes(word)) {
                                        return false;
                                }
                        }

                        for (const filter of filters) {
                                switch (filter) {
                                        case "follows":
                                                if (me) {
                                                        if (!followeeIds) return false;
                                                        if (!followeeIds.has(note.userId) && note.userId !== me.id) {
                                                                return false;
                                                        }
                                                }
                                                break;
                                        case "cw":
                                                if (!note.cw) return false;
                                                break;
                                        case "poll":
                                                if (!note.hasPoll) return false;
                                                break;
                                        case "media":
                                        case "images":
                                        case "videos":
                                                if (!note.fileIds || note.fileIds.length === 0) return false;
                                                break;
                                        case "hashtags":
                                                if (!note.tags || note.tags.length === 0) return false;
                                                break;
                                        case "mention":
                                                if (!note.mentions || note.mentions.length === 0) return false;
                                                break;
                                        case "replies":
                                                if (!note.replyId || note.replyUserId === note.userId) return false;
                                                break;
                                        case "self_threads":
                                                if (!note.replyId || note.replyUserId !== note.userId) return false;
                                                break;
                                        case "quote":
                                                if (!note.renoteId) return false;
                                                if (!note.text && (!note.fileIds || note.fileIds.length === 0)) return false;
                                                break;
                                        case "safe":
                                                if (cwLower.includes("シモ")) return false;
                                                if (cwLower.includes("そぎぎ")) return false;
                                                break;
                                        default:
                                                break;
                                }
                        }

                        return true;
                };
        };

        if (es == null && sonic == null) {
                const query = makePaginationQuery(
                        Notes.createQueryBuilder("note"),
                        ps.sinceId,
                        ps.untilId,
                );

                if (userId) {
                        query.andWhere("note.userId = :userId", { userId });
                }

                if (excludeUserIds.length > 0) {
                        query.andWhere("note.userId NOT IN (:...excludeUserIds)", {
                                excludeUserIds,
                        });
                }

                if (channelId) {
                        query.andWhere("note.channelId = :channelId", { channelId });
                }

                if (host !== undefined) {
                        if (host === null || host === config.host) {
                                query.andWhere("note.userHost IS NULL");
                        } else {
                                query.andWhere("note.userHost = :host", { host });
                        }
                }

                if (normalizedVisibility) {
                        if (circleVisibility) {
                                query.andWhere("note.visibility = 'specified'");
                                query.andWhere("note.ccUserIds != '{}'");
                        } else {
                                query.andWhere("note.visibility = :visibility", {
                                        visibility: normalizedVisibility,
                                });
                        }
                }

                if (localOnly) {
                        query.andWhere("note.localOnly = true");
                }

                if (minScore != null) {
                        query.andWhere("note.score > :minScore", { minScore });
                }

                if (untilId) {
                        query.andWhere("note.id < :untilId", { untilId });
                }

                if (sinceId) {
                        query.andWhere("note.id > :sinceId", { sinceId });
                }

                filters.slice(0, 15).forEach((filter) => {
                        switch (filter) {
                                case "follows":
                                        if (me) {
                                                const followingCondition = createFollowingExistsCondition(me.id);
                                                query.andWhere(
                                                        new Brackets((qb) => {
                                                                qb.where(
                                                                        followingCondition.clause("note.userId"),
                                                                ).orWhere("note.userId = :meId", { meId: me.id });
                                                        }),
                                                );
                                                query.setParameters(followingCondition.parameters);
                                        }
                                        break;
                                case "cw":
                                        query.andWhere("note.cw IS NOT NULL");
                                        break;
                                case "poll":
                                        query.andWhere("note.hasPoll = TRUE");
                                        break;
                                case "media":
                                case "images":
                                case "videos":
                                        query.andWhere('CARDINALITY(note."fileIds") > 0');
                                        break;
                                case "hashtags":
                                        query.andWhere("note.tags != '{}'");
                                        break;
                                case "mention":
                                        query.andWhere("note.mentions != '{}'");
                                        break;
                                case "replies":
                                        query.andWhere("note.replyId IS NOT NULL");
                                        query.andWhere("note.replyUserId != note.userId");
                                        break;
                                case "self_threads":
                                        query.andWhere("note.replyId IS NOT NULL");
                                        query.andWhere("note.replyUserId = note.userId");
                                        break;
                                case "quote":
                                        query.andWhere("note.renoteId IS NOT NULL");
                                        query.andWhere('(note.text IS NOT NULL OR CARDINALITY(note."fileIds") > 0)');
                                        break;
                                case "safe":
                                        query.andWhere(`(note.cw NOT ILIKE '%シモ%' OR note.cw IS NULL)`);
                                        query.andWhere(`(note.cw NOT ILIKE '%そぎぎ%' OR note.cw IS NULL)`);
                                        break;
                                default:
                                        break;
                        }
                });

                includeWords.forEach((word, index) => {
                        const param = `includeWord${index}`;
                        const likeValue = `%${word}%`;
                        query.andWhere(`(note.cw ILIKE :${param} OR note.text ILIKE :${param})`, {
                                [param]: likeValue,
                        });
                });

                excludeWords.forEach((word, index) => {
                        const cwParam = `excludeCw${index}`;
                        const textParam = `excludeText${index}`;
                        const likeValue = `%${word}%`;
                        query.andWhere(`(note.cw NOT ILIKE :${cwParam} OR note.cw IS NULL)`, {
                                [cwParam]: likeValue,
                        });
                        query.andWhere(`note.text NOT ILIKE :${textParam}`, {
                                [textParam]: likeValue,
                        });
                });

                query
                        .andWhere("note.deletedAt IS NULL")
                        .innerJoinAndSelect("note.user", "user")
                        .leftJoinAndSelect("user.avatar", "avatar")
                        .leftJoinAndSelect("user.banner", "banner")
                        .leftJoinAndSelect("note.reply", "reply")
                        .leftJoinAndSelect("note.renote", "renote")
                        .leftJoinAndSelect("reply.user", "replyUser")
                        .leftJoinAndSelect("replyUser.avatar", "replyUserAvatar")
                        .leftJoinAndSelect("replyUser.banner", "replyUserBanner")
                        .leftJoinAndSelect("renote.user", "renoteUser")
                        .leftJoinAndSelect("renoteUser.avatar", "renoteUserAvatar")
                        .leftJoinAndSelect("renoteUser.banner", "renoteUserBanner");

                generateVisibilityQuery(query, me);
                if (me) generateMutedUserQuery(query, me);
                if (me) generateBlockedUserQuery(query, me);

                const notes: Note[] = await query.take(ps.limit).getMany();

                const { userMap, noteMap } = buildUserAndNoteMapsFromNotes(notes);
                return await Notes.packMany(notes, me, {
                        _hint_: { userMap, noteMap },
                });
        } else if (sonic) {
                const chunkSize = 100;
                let offset = 0;

                const ids: string[] = [];
                while (true) {
                        const results = await sonic.search.query(
                                sonic.collection,
                                sonic.bucket,
                                ps.query,
                                {
                                        limit: chunkSize,
                                        offset,
                                },
                        );

                        offset += chunkSize;

                        if (results.length === 0) {
                                break;
                        }

                        const res = results
                                .map((k) => JSON.parse(k))
                                .filter((key: { id: string; userId: string; userHost: string | null; channelId: string | null }) => {
                                        if (userId && key.userId !== userId) return false;
                                        if (excludeUserIds.includes(key.userId)) return false;
                                        if (channelId && key.channelId !== channelId) return false;
                                        if (host !== undefined) {
                                                if (host === null || host === config.host) {
                                                        if (key.userHost != null) return false;
                                                } else if (key.userHost !== host) {
                                                        return false;
                                                }
                                        }
                                        if (ps.sinceId && key.id <= ps.sinceId) return false;
                                        if (ps.untilId && key.id >= ps.untilId) return false;
                                        if (sinceId && key.id <= sinceId) return false;
                                        if (untilId && key.id >= untilId) return false;
                                        return true;
                                })
                                .map((key) => key.id);

                        ids.push(...res);
                }

                ids.sort((a, b) => b.localeCompare(a));

                const followeeIds =
                        filters.includes("follows") && me
                                ? new Set(
                                          (
                                                  await Followings.createQueryBuilder("following")
                                                          .select("following.followeeId", "followeeId")
                                                          .where("following.followerId = :followerId", {
                                                                  followerId: me.id,
                                                          })
                                                          .getRawMany()
                                          ).map((row) => row.followeeId as string),
                                  )
                                : null;

                const matchesFilters = createNoteMatcher(followeeIds);

                const found: Note[] = [];
                let index = 0;
                while (found.length < ps.limit && index < ids.length) {
                        const chunk = ids.slice(index, index + chunkSize);
                        const notes: Note[] = await Notes.find({
                                where: { id: In(chunk) },
                                order: { id: "DESC" },
                        });

                        const filtered = notes.filter(matchesFilters);
                        if (filtered.length > 0) {
                                found.push(...filtered);
                        }

                        index += chunkSize;
                }

                found.sort((a, b) => b.id.localeCompare(a.id));

                const packed = await Notes.packMany(found.slice(0, ps.limit), me);

                return packed;
        } else {
                const must: any[] = [
                        {
                                simple_query_string: {
                                        fields: ["text"],
                                        query: ps.query.toLowerCase(),
                                        default_operator: "and",
                                },
                        },
                ];

                const mustNot: any[] = [];

                if (userId) {
                        must.push({ term: { userId } });
                }

                if (channelId) {
                        must.push({ term: { channelId } });
                }

                if (host !== undefined) {
                        if (host === null || host === config.host) {
                                must.push({
                                        bool: {
                                                must_not: {
                                                        exists: { field: "userHost" },
                                                },
                                        },
                                });
                        } else {
                                must.push({ term: { userHost: host } });
                        }
                }

                if (excludeUserIds.length > 0) {
                        mustNot.push({ terms: { userId: excludeUserIds } });
                }

                if (ps.sinceId) {
                        must.push({ range: { id: { gt: ps.sinceId } } });
                }

                if (ps.untilId) {
                        must.push({ range: { id: { lt: ps.untilId } } });
                }

                if (sinceId) {
                        must.push({ range: { id: { gt: sinceId } } });
                }

                if (untilId) {
                        must.push({ range: { id: { lt: untilId } } });
                }

                const result = await es.search({
                        index: config.elasticsearch.index || "misskey_note",
                        body: {
                                size: ps.limit,
                                from: ps.offset,
                                query: {
                                        bool: {
                                                must,
                                                must_not: mustNot,
                                        },
                                },
                                sort: [
                                        {
                                                _doc: "desc",
                                        },
                                ],
                        },
                });

                const hits = result.body.hits.hits.map((hit: any) => hit._id as string);

                if (hits.length === 0) return [];

                const followeeIds =
                        filters.includes("follows") && me
                                ? new Set(
                                          (
                                                  await Followings.createQueryBuilder("following")
                                                          .select("following.followeeId", "followeeId")
                                                          .where("following.followerId = :followerId", {
                                                                  followerId: me.id,
                                                          })
                                                          .getRawMany()
                                          ).map((row) => row.followeeId as string),
                                  )
                                : null;

                const matcher = createNoteMatcher(followeeIds);

                const notes = await Notes.find({
                        where: { id: In(hits) },
                });

                notes.sort((a, b) => b.id.localeCompare(a.id));

                const filtered = notes.filter(matcher);

                const packed = await Notes.packMany(filtered.slice(0, ps.limit), me);

                return packed;
        }
});
