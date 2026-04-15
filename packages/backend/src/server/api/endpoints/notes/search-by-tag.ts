/**
 * @packageDocumentation
 *
 * 指定タグでノートを検索する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/search-by-tag`（GET `/api/notes/search-by-tag` で呼び出し）
 * - 認証は不要（プライベートモード時は必須）。tag で指定したハッシュタグ付きノートを取得する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { Notes } from "@/models/index.js";
import { safeForSql } from "@/misc/safe-for-sql.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";
import define from "../../define.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";

export const meta = {
	tags: ["notes", "hashtags"],
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
} as const;

export const paramDef = {
	type: "object",
	properties: {
		reply: { type: "boolean", nullable: true, default: null },
		renote: { type: "boolean", nullable: true, default: null },
		withFiles: {
			type: "boolean",
			default: false,
			description: "true のとき、ファイルが添付されたノートのみ返します。",
		},
		poll: { type: "boolean", nullable: true, default: null },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
	},
	anyOf: [
		{
			properties: {
				tag: { type: "string", minLength: 1 },
				userId: {
					type: "string",
					format: "misskey:id",
					nullable: true,
				},
			},
			required: ["tag"],
		},
		{
			properties: {
				query: {
					type: "array",
					description:
						"The outer arrays are chained with OR, the inner arrays are chained with AND.",
					items: {
						type: "array",
						items: {
							type: "string",
							minLength: 1,
						},
						minItems: 1,
					},
					minItems: 1,
				},
			},
			required: ["query"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
	)
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

	// NOTE: 未認証リクエストではハッシュタグ検索結果をローカル投稿に限定する。
	if (me == null) {
		query.andWhere("note.userHost IS NULL");
	}

	generateVisibilityQuery(query, me);
	if (me) generateMutedUserQuery(query, me);
	if (me) generateBlockedUserQuery(query, me);

	try {
		if (ps.tag && !Array.isArray(ps.tag)) {
			if (!safeForSql(normalizeForSearch(ps.tag))) throw "Injection";
			if (ps.userId) query.andWhere("note.userId = :id", { id: ps.userId });
			query.andWhere(`'{"${normalizeForSearch(ps.tag)}"}' <@ note.tags`);
		} else {
			query.andWhere(
				new Brackets((qb) => {
					for (const tags of ps.query!) {
						qb.orWhere(
							new Brackets((qb) => {
								for (const tag of tags) {
									if (!safeForSql(normalizeForSearch(ps.tag)))
										throw "Injection";
									if (ps.userId) qb.andWhere("note.userId = :id", { id: ps.userId });
									qb.andWhere(`'{"${normalizeForSearch(tag)}"}' <@ note.tags`);
								}
							}),
						);
					}
				}),
			);
		}
	} catch (e) {
		if (e.message === "Injection") return [];
		throw e;
	}

	if (ps.reply != null) {
		if (ps.reply) {
			query.andWhere("note.replyId IS NOT NULL");
		} else {
			query.andWhere("note.replyId IS NULL");
		}
	}

	if (ps.renote != null) {
		if (ps.renote) {
			query.andWhere("note.renoteId IS NOT NULL");
		} else {
			query.andWhere("note.renoteId IS NULL");
		}
	}

        if (ps.withFiles) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
        }

	if (ps.poll != null) {
		if (ps.poll) {
			query.andWhere("note.hasPoll = TRUE");
		} else {
			query.andWhere("note.hasPoll = FALSE");
		}
	}

	// フィルタで除外されるため要求より多めに取得し、件数が不足するとページネーションを打ち切る。
	const found = [];
	const take = Math.floor(ps.limit * 1.5);
	let skip = 0;
	while (found.length < ps.limit) {
		const notes = await query.take(take).skip(skip).getMany();
		const { userMap, noteMap } = buildUserAndNoteMapsFromNotes(notes);
		found.push(
			...(await Notes.packMany(notes, me, {
				_hint_: { userMap, noteMap },
			})),
		);
		skip += take;
		if (notes.length < take) break;
	}

	if (found.length > ps.limit) {
		found.length = ps.limit;
	}

	return found;
});
