import { In } from "typeorm";
import { Notes } from "@/models/index.js";
import { Note } from "@/models/entities/note.js";
import config from "@/config/index.js";
import es from "../../../../db/elasticsearch.js";
import sonic from "../../../../db/sonic.js";
import define from "../../define.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";

export const meta = {
	tags: ["notes"],

	requireCredential: false,
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
	},
	required: ["query"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	let que = ps.query;
	if (es == null && sonic == null) {
		let plusQueryCount = 0;
		const query = makePaginationQuery(
			Notes.createQueryBuilder("note"),
			ps.sinceId,
			ps.untilId,
		);

		if (ps.userId || que.includes("user:") || que.toLowerCase().includes("from:me")) {
			let qUserId = ps.userId;
			if (que.toLowerCase().includes("from:me")) {
				if (me) {
					qUserId = me.id;
				}
				que = que.replace(/from:me/i, "")
			}
			if (!qUserId) {
				const match = /(^|[\s\+])user:(\w{10})($|[\s\+])/i.exec(que)
				qUserId = match?.[2];
				que = que.replace(/(^|[\s\+])user:(\w{10})($|[\s\+])/i, "")
			}
			if (qUserId) {
				query.andWhere("note.userId = :userId", { userId: qUserId });
			}
		}
		if (ps.channelId || que.includes("channel:")) {
			let qChannelId = ps.channelId;
			if (!qChannelId) {
				const match = /(^|[\s\+])channel:(\w{10})($|[\s\+])/i.exec(que)
				qChannelId = match?.[2];
				que = que.replace(/(^|[\s\+])channel:(\w{10})($|[\s\+])/i, "")
			}
			if (qChannelId) {
				query.andWhere("note.channelId = :channelId", {
					channelId: qChannelId,
				});
			}
		}
		if (ps.host || que.includes("host:")) {
			let qHost = ps.host;
			if (!qHost) {
				const match = /(^|[\s\+])host:([^\s\+]+)($|[\s\+])/i.exec(que)
				qHost = match?.[2];
				que = que.replace(/(^|[\s\+])host:([^\s\+]+)($|[\s\+])/i, "")
			}
			if (qHost) {
				plusQueryCount += 1
				if (qHost === "." || qHost === config.host) {
					query.andWhere("note.userHost IS NULL");
				} else {
					query.andWhere("note.userHost = :host", {
						host: qHost,
					});
				}
			}
		}
		if (ps.visibility || que.includes("visibility:")) {
			let qVisibility = ps.visibility;
			if (!qVisibility) {
				const match = /(^|[\s\+])visibility:([^\s\+]+)($|[\s\+])/i.exec(que)
				qVisibility = match?.[2];
				que = que.replace(/(^|[\s\+])visibility:([^\s\+]+)($|[\s\+])/i, "")
			}
			if (qVisibility) {
				plusQueryCount += 1
				if (qVisibility === "全公開") qVisibility = "public";
				if (qVisibility === "ホーム") qVisibility = "home";
				if (qVisibility === "フォロワー") qVisibility = "followers";
				if (qVisibility === "ダイレクト" || qVisibility === "direct") qVisibility = "specified";
				query.andWhere("note.visibility = :visibility", {
					visibility: qVisibility,
				});
			}
		}
		if (ps.local || que.includes("local:")) {
			let qLocal = ps.local;
			if (!qLocal) {
				const match = /(^|[\s\+])local:([^\s\+]+)($|[\s\+])/i.exec(que)
				qLocal = ["true", "on", "yes", "only"].includes(match?.[2].toLowerCase());
				que = que.replace(/(^|[\s\+])local:([^\s\+]+)($|[\s\+])/i, "")
			}
			if (qLocal) {
				plusQueryCount += 1
				query.andWhere("note.localOnly = :localOnly", {
					localOnly: qLocal ? true : false,
				});
			}
		}
		if (ps.minScore || que.includes("score:")) {
			let qScore = ps.score;
			if (!qScore) {
				const match = /(^|[\s\+])score:(\d+)($|[\s\+])/i.exec(que)
				qScore = match?.[2];
				que = que.replace(/(^|[\s\+])score:(\d+)($|[\s\+])/i, "")
			}
			if (qScore) {
				plusQueryCount += 1
				query.andWhere("note.score > :score", {
					score: qScore,
				});
			}
		}


		if (que.replaceAll(/[\s\+]/g,"") === "" && plusQueryCount === 0) return [];

		const queWords = que.replaceAll(/\s/g, "+").split("+");

		queWords.forEach((x) => {
			if (x.startsWith("-")){
				query.andWhere(`note.text NOT ILIKE '%${x.substring(1)}%'`);
			} else {
				plusQueryCount += 1
				query.andWhere(`note.text ILIKE '%${x}%'`);
			}
		});
		
		if (plusQueryCount === 0) return [];

		query
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

		return await Notes.packMany(notes, me);
	} else if (sonic) {
		let start = 0;
		const chunkSize = 100;

		// Use sonic to fetch and step through all search results that could match the requirements
		const ids = [];
		while (true) {
			const results = await sonic.search.query(
				sonic.collection,
				sonic.bucket,
				ps.query,
				{
					limit: chunkSize,
					offset: start,
				},
			);

			start += chunkSize;

			if (results.length === 0) {
				break;
			}

			const res = results
				.map((k) => JSON.parse(k))
				.filter((key) => {
					if (ps.userId && key.userId !== ps.userId) {
						return false;
					}
					if (ps.channelId && key.channelId !== ps.channelId) {
						return false;
					}
					if (ps.sinceId && key.id <= ps.sinceId) {
						return false;
					}
					if (ps.untilId && key.id >= ps.untilId) {
						return false;
					}
					return true;
				})
				.map((key) => key.id);

			ids.push(...res);
		}

		// Sort all the results by note id DESC (newest first)
		ids.sort((a, b) => b - a);

		// Fetch the notes from the database until we have enough to satisfy the limit
		start = 0;
		const found = [];
		while (found.length < ps.limit && start < ids.length) {
			const chunk = ids.slice(start, start + chunkSize);
			const notes: Note[] = await Notes.find({
				where: {
					id: In(chunk),
				},
				order: {
					id: "DESC",
				},
			});

			// The notes are checked for visibility and muted/blocked users when packed
			found.push(...(await Notes.packMany(notes, me)));
			start += chunkSize;
		}

		// If we have more results than the limit, trim them
		if (found.length > ps.limit) {
			found.length = ps.limit;
		}

		return found;
	} else {
		const userQuery =
			ps.userId != null
				? [
					{
						term: {
							userId: ps.userId,
						},
					},
				]
				: [];

		const hostQuery =
			ps.userId == null
				? ps.host === null
					? [
						{
							bool: {
								must_not: {
									exists: {
										field: "userHost",
									},
								},
							},
						},
					]
					: ps.host !== undefined
						? [
							{
								term: {
									userHost: ps.host,
								},
							},
						]
						: []
				: [];

		const result = await es.search({
			index: config.elasticsearch.index || "misskey_note",
			body: {
				size: ps.limit,
				from: ps.offset,
				query: {
					bool: {
						must: [
							{
								simple_query_string: {
									fields: ["text"],
									query: ps.query.toLowerCase(),
									default_operator: "and",
								},
							},
							...hostQuery,
							...userQuery,
						],
					},
				},
				sort: [
					{
						_doc: "desc",
					},
				],
			},
		});

		const hits = result.body.hits.hits.map((hit: any) => hit._id);

		if (hits.length === 0) return [];

		// Fetch found notes
		const notes = await Notes.find({
			where: {
				id: In(hits),
			},
			order: {
				id: -1,
			},
		});

		return await Notes.packMany(notes, me);
	}
});
