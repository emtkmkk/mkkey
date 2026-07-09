/**
 * @packageDocumentation
 *
 * 指定ノートをリノートしたユーザー一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/renotes`（GET `/api/notes/renotes` で呼び出し）
 * - 認証は不要（プライベート時は必須）。noteId で指定したノートをリノートしたユーザーをページネーションで返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { fetchPackedNotesWithOverfetch } from "../../common/fetch-packed-notes-with-overfetch.js";
import { getNote } from "../../common/getters.js";
import { ApiError } from "../../error.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";

export const meta = {
	tags: ["notes"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description:
		"指定した投稿をリノートした投稿一覧を取得する。sinceId/untilId/limit でページネーション可能。リノートしたユーザー情報も含まれる。",

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
		noSuchNote: {
			message: "その投稿は存在しません。",
			code: "NO_SUCH_NOTE",
			id: "12908022-2e21-46cd-ba6a-3edaf6093f46",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: {
			type: "string",
			format: "misskey:id",
			description: "リノート一覧を取得する投稿の ID。",
		},
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
		withUserRenoteCount: { type: "boolean", default: false },
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const note = await getNote(ps.noteId, user).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere("note.renoteId = :renoteId", { renoteId: note.id })
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

	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);

	const found = await fetchPackedNotesWithOverfetch({
		query,
		limit: ps.limit,
		pagination: ps,
		me: user,
	});

	if (!ps.withUserRenoteCount || found.length === 0) {
		return found;
	}

	const userIds = [...new Set(found.map((packedNote) => packedNote.userId))];

	if (userIds.length === 0) {
		return found;
	}

	const countQuery = Notes.createQueryBuilder("note")
		.select("note.userId", "userId")
		.addSelect("COUNT(note.id)", "count")
		.where("note.renoteId = :renoteId", { renoteId: note.id })
		.andWhere("note.userId IN (:...userIds)", { userIds })
		.groupBy("note.userId");

	generateVisibilityQuery(countQuery, user);
	if (user) generateMutedUserQuery(countQuery, user);
	if (user) generateBlockedUserQuery(countQuery, user);

	const renoteCountRows = await countQuery.getRawMany<{
		userId: string;
		count: string;
	}>();

	const renoteCountsByUserId = new Map<string, number>(
		renoteCountRows.map((row) => [row.userId, Number(row.count)])
	);

	for (const packedNote of found) {
		(packedNote as Record<string, any>).userRenoteCount =
			renoteCountsByUserId.get(packedNote.userId) ?? 1;
	}

	return found;
});
