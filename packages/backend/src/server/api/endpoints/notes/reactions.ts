/**
 * @packageDocumentation
 *
 * ノートのリアクション一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/reactions`（GET `/api/notes/reactions` で呼び出し）
 * - 認証は不要（プライベートノートは要認証）。noteId で指定したノートへのリアクションを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { NoteReactions } from "@/models/index.js";
import { Blocking } from "@/models/entities/blocking.js";
import { Following } from "@/models/entities/following.js";
import { Muting } from "@/models/entities/muting.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getNote } from "../../common/getters.js";

export const meta = {
	tags: ["notes", "reactions"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	allowGet: true,
	cacheSec: 60,

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "NoteReaction",
		},
	},

	errors: {
		noSuchNote: {
			message: "その投稿は存在しません。",
			code: "NO_SUCH_NOTE",
			id: "263fff3d-d0e1-4af4-bea7-8408059b451a",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: {
			type: "string",
			format: "misskey:id",
			description: "リアクション一覧を取得する投稿の ID。",
		},
		type: { type: "string", nullable: true },
		excludeType: { type: "string", nullable: true },
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
		offset: {
			type: "integer",
			default: 0,
			description: "先頭からスキップする件数。",
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
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// ノートの公開範囲を確認する
	const note = await getNote(ps.noteId, user).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

	let query = NoteReactions.createQueryBuilder("reaction").where(
		"reaction.noteId = :noteId",
		{ noteId: note.id },
	);

	if (user?.id) {
                if (note.userId !== user.id) {
                        const followingExistsQuery = query
                                .subQuery()
                                .select("1")
                                .from(Following, "following")
                                .where("following.followerId = :viewerId", { viewerId: user.id })
                                .andWhere("following.followeeId = reaction.userId")
                                .getQuery();

                        query.andWhere(
                                new Brackets((qb2) => {
                                        qb2.where(`EXISTS ${followingExistsQuery}`);
                                        qb2.orWhere("user.isExplorable = true");
                                }),
                        );
                }

                const mutingExistsQuery = query
                        .subQuery()
                        .select("1")
                        .from(Muting, "muting")
                        .where("muting.muterId = :viewerId", { viewerId: user.id })
                        .andWhere("muting.muteeId = reaction.userId")
                        .getQuery();

                query.andWhere(`NOT EXISTS ${mutingExistsQuery}`);

                const blockingExistsQuery = query
                        .subQuery()
                        .select("1")
                        .from(Blocking, "blocking")
                        .where("blocking.blockerId = :viewerId", { viewerId: user.id })
                        .andWhere("blocking.blockeeId = reaction.userId")
                        .getQuery();

                query.andWhere(`NOT EXISTS ${blockingExistsQuery}`);

                const blockedExistsQuery = query
                        .subQuery()
                        .select("1")
                        .from(Blocking, "blocking")
                        .where("blocking.blockeeId = :viewerId", { viewerId: user.id })
                        .andWhere("blocking.blockerId = reaction.userId")
                        .getQuery();

                query.andWhere(`NOT EXISTS ${blockedExistsQuery}`);
	} else {
		query.andWhere(
			"user.isExplorable = true AND user.isRemoteExplorable = true",
		);
	}

	if (ps.type && (note.userId === user?.id || note?.isPublicLikeList)) {
		// ローカルリアクションはホスト名が . とされているが
		// DB 上ではそうではないので、必要に応じて変換
		// @.指定の場合、同名絵文字のリアクションを全て返す
		const suffix = "@.:";
		if (ps.type.endsWith(suffix)) {
			query.andWhere(
				"(reaction.reaction = :type OR reaction.reaction LIKE :typelike)",
				{
					type: `${ps.type.slice(0, ps.type.length - suffix.length)}:`,
					typelike: `${ps.type.slice(0, ps.type.length - suffix.length)}@%:`,
				},
			);
		} else {
			query.andWhere("reaction.reaction = :type", { type: ps.type });
		}
	}

	// excludeType: 指定されたリアクションタイプを除外（誰でも使用可能）
	if (ps.excludeType) {
		const suffix = "@.:";
		if (ps.excludeType.endsWith(suffix)) {
			query.andWhere(
				"NOT (reaction.reaction = :excludeType OR reaction.reaction LIKE :excludeTypelike)",
				{
					excludeType: `${ps.excludeType.slice(0, ps.excludeType.length - suffix.length)}:`,
					excludeTypelike: `${ps.excludeType.slice(0, ps.excludeType.length - suffix.length)}@%:`,
				},
			);
		} else {
			query.andWhere("reaction.reaction != :excludeType", { excludeType: ps.excludeType });
		}
	}

	query
		.innerJoinAndSelect("reaction.note", "note")
		.innerJoinAndSelect("reaction.user", "user")
		.leftJoinAndSelect("user.avatar", "avatar")
		.leftJoinAndSelect("user.banner", "banner");

	query.orderBy("reaction.id", "DESC");

	const reactions = await query.take(ps.limit).skip(ps.offset).getMany();

	return await NoteReactions.packMany(reactions, user);
});
