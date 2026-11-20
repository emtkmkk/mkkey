/**
 * @packageDocumentation
 *
 * 投稿検索 API（`notes/search`）。
 *
 * @remarks
 * - クエリ文字列をスペースまたは `+` で区切り、各トークンを AND 条件として解釈する。
 *   `key:value` 形式のトークンは絞り込み条件として扱う
 *   （`user:` / `channel:` / `file:` / `host:` / `visibility:` / `local:` / `score:` / `filter:` / `since:` / `until:`、
 *   および `from:me` / `-user:` / `-語`）。
 * - `file:<ドライブファイルID>` は、そのファイルを添付している投稿だけに絞る。
 *   ドライブのファイルメニューの「このファイルを使った投稿を検索」から使われる。
 * - Elasticsearch も Sonic も無いときは DB を直接検索する（mkkey.net の本番はこの経路）。
 *   ES / Sonic の経路では、検索結果を `createNoteMatcher` で後から絞り込む。
 * - DB 経路で検索語があるときは 2 段階で探す（{@link searchNotesInDb}）。
 *   まず従来の ILIKE のクエリを 2 秒だけ試し、間に合わなければ pgroonga で候補の id を集めてから絞り直す。
 *   よく出る語は 1 段目ですぐ終わり、まれな語（従来は数十秒〜数十分かかっていた）は 2 段目で 1 秒以内に絞れる。
 *   pgroonga のインデックスが無い環境では 1 段目だけ（従来どおり）。
 *   詳細と、pgroonga と ILIKE の一致の仕方の違いは {@link ../../common/note-search-pgroonga.ts}。
 *
 * @internal
 */
import { In, Brackets } from "typeorm";
import type { SelectQueryBuilder } from "typeorm";
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
import { db } from "@/db/postgre.js";
import {
	findNoteIdsByPgroonga,
	hasNoteSearchPgroongaIndexes,
	isQueryCanceledError,
	pickCandidateWord,
} from "../../common/note-search-pgroonga.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";

export const meta = {
	tags: ["notes"],

	requireCredential: true,
	kind: "read:account",
	requireCredentialPrivateMode: true,

	description:
		"投稿を全文検索する。クエリ・ユーザー・チャンネル・公開範囲・ホストなどで絞り込める。sinceId/untilId/limit/offset でページネーション可能。",

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
		query: {
			type: "string",
			description:
				"検索クエリ。スペースや + で区切った複数トークンは AND 検索。file:<ドライブファイルID> でそのファイルを添付した投稿に絞れる。",
		},
		sinceId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より新しい投稿から取得。",
		},
		untilId: {
			type: "string",
			format: "misskey:id",
			description: "この ID より古い投稿から取得。",
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得件数。",
		},
		offset: {
			type: "integer",
			default: 0,
			description: "先頭からスキップする件数。",
		},
		host: {
			type: "string",
			nullable: true,
			description: "投稿者のホストで絞る。ローカルは null。",
		},
		userId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			default: null,
			description: "投稿者のユーザー ID で絞る。",
		},
		channelId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			default: null,
			description: "チャンネル ID で絞る。",
		},
		visibility: {
			type: "string",
			nullable: true,
			default: null,
			description: "公開範囲で絞る。",
		},
		local: {
			type: "boolean",
			nullable: true,
			default: null,
			description: "true ならローカル投稿のみ。",
		},
		minScore: {
			type: "integer",
			nullable: true,
			default: null,
			description: "検索スコアの下限。これ未満の投稿は返さない。",
		},
		excludeUserIds: {
			type: "array",
			items: {
				type: "string",
				format: "misskey:id",
			},
			nullable: true,
			default: [],
			description: "除外する投稿者のユーザー ID 配列。",
		},
	},
	required: ["query"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
        const tokens = ps.query.split(/[\s\+]+/).filter((token) => token.length > 0);

        let userId = ps.userId ?? null;
        let channelId = ps.channelId ?? null;
        // undefined: 指定なし / null: ローカルのみ（host:. など） / 文字列: そのホストのみ
        let host: string | null | undefined = ps.host ?? undefined;
        let visibility = ps.visibility ?? null;
        let localOnly = ps.local === true ? true : null;
        let minScore = ps.minScore ?? null;
        // file:<ドライブファイルID> で指定された「このファイルを添付している投稿」の絞り込み
        let fileId: string | null = null;
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
                        case "file":
                                if (value) fileId = value;
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
                fileId != null ||
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
                        if (fileId && !note.fileIds?.includes(fileId)) return false;
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
                // 検索条件をすべて付けたクエリを作る。1 段目（ILIKE だけ）と 2 段目（pgroonga の候補で絞る）で同じ条件を使うため関数にしている
                const buildQuery = (
                        base: SelectQueryBuilder<Note>,
                        candidateIds: string[] | null,
                ): SelectQueryBuilder<Note> => {
                        const query = makePaginationQuery(base, ps.sinceId, ps.untilId);

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

                        if (fileId) {
                                // NB: `:fileId = ANY(note.fileIds)` と書くと GIN インデックス IDX_NOTE_FILE_IDS が使われず、
                                // note 全件のシーケンシャルスキャンになる。必ず `@>` で書くこと（本番で最悪 36ms を確認済み）。
                                // NB: 値を見ない汎用プラン（名前付き PREPARE を繰り返したとき）だと主キーの逆順スキャンが選ばれ、
                                // 未使用ファイルで全件を舐める。node-postgres は名前なしの prepared statement で毎回値を見て
                                // プランを立てるので問題ないが、名前付きの prepared statement にはしないこと。
                                query.andWhere('note."fileIds" @> ARRAY[:fileId]::varchar[]', {
                                        fileId,
                                });
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

                        if (candidateIds) {
                                // pgroonga で集めた候補だけに絞る。ILIKE などの条件はそのまま残るので、結果の正しさは変わらない
                                query.andWhere("note.id = ANY(CAST(:candidateIds AS varchar[]))", { candidateIds });
                        }

                        return query.take(ps.limit);
                };

                // ページ送りの id と since: / until: の日付の、両方の範囲を満たす id だけが結果になる
                const lowerId = [ps.sinceId, sinceId].filter((x): x is string => !!x).sort().at(-1) ?? null;
                const upperId = [ps.untilId, untilId].filter((x): x is string => !!x).sort()[0] ?? null;
                const notes = await searchNotesInDb(buildQuery, includeWords, lowerId, upperId);

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
                // ここに来るのは Elasticsearch が設定されている場合のみ（上の分岐で es も sonic も無い場合を処理済み）
                if (es == null) {
                	throw new Error("search: elasticsearch client is not available");
                }

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

// #region DB 検索（ILIKE を短く試し、間に合わなければ pgroonga で候補を絞る）

/** 1 段目（ILIKE だけ）に使う時間（ミリ秒）。よく出る語はたいてい 0.5 秒以内に終わる */
const ilikeBudgetMs = 2000;

/** 2 段目（pgroonga で候補を集めて絞る）の上限時間（ミリ秒）。これを超えたらエラーにして DB を長く占有しない */
const pgroongaBudgetMs = 30000;

/** 2 段目で使う候補の最大件数。多すぎると id の配列が巨大になるので、新しい方から残す */
const maxCandidateIds = 100000;

/**
 * 投稿を DB で検索する（Elasticsearch も Sonic も無いときの経路）。
 *
 * @remarks
 * - 検索語が無いとき、または pgroonga のインデックスが無いときは、従来どおり {@link buildQuery} のクエリをそのまま実行する。
 * - 検索語があるときは、まず同じクエリを {@link ilikeBudgetMs} だけ試す。よく出る語なら、新しい順にたどってすぐ件数がそろう。
 * - 時間切れになったら（まれな語）、一番長い語で pgroonga から候補の id を集め、クエリに id の条件を足して実行し直す。
 *   どちらの段も同じ条件のクエリなので、返る結果は同じ（pgroonga との一致の仕方の違いは
 *   {@link ../../common/note-search-pgroonga.ts} の NB を参照）。
 * - 時間制限は `SET LOCAL statement_timeout` で付けるため、各段をトランザクションの中で実行する。
 *   pgbouncer の transaction モードでも、トランザクションの終わりで元に戻る。
 *
 * @param buildQuery - 検索条件をすべて付けたクエリを作る関数。第 2 引数に候補の id を渡すと、その中に絞る
 * @param includeWords - 検索語（AND 条件）
 * @param lowerId - この id より新しいものだけが結果になる（無ければ null）。候補を先に絞るのに使う
 * @param upperId - この id より古いものだけが結果になる（無ければ null）。候補を先に絞るのに使う
 * @returns 見つかった投稿
 * @throws QueryFailedError - 2 段目も時間切れになったとき、またはその他の DB エラー
 * @internal
 */
async function searchNotesInDb(
	buildQuery: (
		base: SelectQueryBuilder<Note>,
		candidateIds: string[] | null,
	) => SelectQueryBuilder<Note>,
	includeWords: readonly string[],
	lowerId: string | null,
	upperId: string | null,
): Promise<Note[]> {
	const candidateWord = pickCandidateWord(includeWords);
	if (candidateWord == null || !(await hasNoteSearchPgroongaIndexes())) {
		return await buildQuery(Notes.createQueryBuilder("note"), null).getMany();
	}

	// 1 段目: 従来のクエリを短い時間だけ試す
	const firstTry = await db
		.transaction(async (em) => {
			await em.query(`SET LOCAL statement_timeout = ${ilikeBudgetMs}`);
			return await buildQuery(em.createQueryBuilder(Note, "note"), null).getMany();
		})
		.catch((e: unknown) => {
			if (isQueryCanceledError(e)) return null;
			throw e;
		});
	if (firstTry != null) return firstTry;

	// 2 段目: pgroonga で候補を集めてから絞る
	return await db.transaction(async (em) => {
		await em.query(`SET LOCAL statement_timeout = ${pgroongaBudgetMs}`);
		const candidateIds = (await findNoteIdsByPgroonga(em, candidateWord))
			// id は時刻順の文字列なので、ページ送りの範囲は文字列の比較で絞れる
			.filter((id) => (lowerId == null || id > lowerId) && (upperId == null || id < upperId))
			.sort()
			.reverse()
			.slice(0, maxCandidateIds);
		if (candidateIds.length === 0) return [];
		return await buildQuery(em.createQueryBuilder(Note, "note"), candidateIds).getMany();
	});
}

// #endregion
