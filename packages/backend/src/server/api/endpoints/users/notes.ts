/**
 * @packageDocumentation
 *
 * 指定ユーザーのノート一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/notes`（GET `/api/users/notes` で呼び出し）
 * - 認証は不要（プライベート時は必須）。userId で指定したユーザーの投稿をページネーションで返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { buildNotePackHintFromTimeline } from "../../common/build-note-pack-hint.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";

export const meta = {
	tags: ["users", "notes"],

	requireCredentialPrivateMode: true,
	description: "指定ユーザーが投稿したノート一覧を取得します。",

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

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "27e494ba-2ac2-48e8-893b-10d4d8c2387b",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: {
			type: "string",
			format: "misskey:id",
			description: "投稿一覧を取得するユーザーの ID。",
		},
		includeReplies: { type: "boolean", default: true },
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
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
		includeMyRenotes: { type: "boolean", default: true },
		withFiles: { type: "boolean", default: false },
		showVisitor: { type: "boolean", default: false },
		privateOnly: { type: "boolean", default: false },
		fileType: {
			type: "array",
			items: {
				type: "string",
			},
		},
		excludeNsfw: { type: "boolean", default: false },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// ユーザーを検索する
	const user = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// NOTE: 未認証時はリモートユーザーの投稿一覧取得を拒否する。
	if (me == null && user.host != null) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	//#region クエリ構築
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
	)
		.andWhere("note.userId = :userId", { userId: user.id })
		.innerJoinAndSelect("note.user", "user")
		.leftJoinAndSelect("note.reply", "reply")
		.leftJoinAndSelect("note.renote", "renote")
		.leftJoinAndSelect("reply.user", "replyUser")
		.leftJoinAndSelect("renote.user", "renoteUser");

	generateVisibilityQuery(query, ps.showVisitor ? null : me);
	if (me) {
		generateMutedUserQuery(query, me, user);
		generateBlockedUserQuery(query, me);
	}

        if (ps.withFiles) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
        }

        if (ps.fileType != null) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
		query.andWhere(
			new Brackets((qb) => {
				for (const type of ps.fileType!) {
					const i = ps.fileType!.indexOf(type);
					qb.orWhere(`:type${i} = ANY(note.attachedFileTypes)`, {
						[`type${i}`]: type,
					});
				}
			}),
		);

		if (ps.excludeNsfw) {
			query.andWhere("note.cw IS NULL");
			// 1 件でも isSensitive なファイルがあれば除外。EXISTS で最初の 1 行で打ち切り、COUNT より軽い
			query.andWhere(
				`NOT EXISTS (SELECT 1 FROM drive_file df WHERE df.id = ANY(note."fileIds") AND df."isSensitive" = TRUE LIMIT 1)`,
			);
		}
	}

	if (!ps.includeReplies) {
		query.andWhere(
			new Brackets((qb) => {
				qb.where(
					// 返信が自分なら表示する
					"note.replyId IS NULL",
				).orWhere("note.replyUserId  = :userId", { userId: user.id });
			}),
		);
	}

	if (ps.includeMyRenotes === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.userId != :userId", { userId: user.id });
				qb.orWhere("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
			}),
		);
	}

	if (ps.privateOnly === true) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.visibility = 'followers'");
				qb.orWhere("note.visibility = 'specified'");
			}),
		);
	}

	//#endregion

	const timeline = await query.take(ps.limit).getMany();

	const { userMap, noteMap } = await buildNotePackHintFromTimeline(timeline);
	return await Notes.packMany(timeline, me, {
		_hint_: { userMap, noteMap },
	});
});
