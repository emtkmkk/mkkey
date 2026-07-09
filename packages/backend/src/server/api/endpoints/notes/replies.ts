/**
 * @packageDocumentation
 *
 * 指定ノートへの返信一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/replies`（GET `/api/notes/replies` で呼び出し）
 * - 認証は不要（プライベート時は必須）。noteId で指定したノートへの返信をページネーションで返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { fetchPackedNotesWithOverfetch } from "../../common/fetch-packed-notes-with-overfetch.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";

export const meta = {
	tags: ["notes"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description:
		"指定した投稿への返信一覧を取得する。sinceId/untilId/limit でページネーション可能。閲覧可能な返信のみ返す。",

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
		noteId: {
			type: "string",
			format: "misskey:id",
			description: "返信一覧を取得する投稿の ID。",
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
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
	)
		.andWhere("note.replyId = :replyId", { replyId: ps.noteId })
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

	return await fetchPackedNotesWithOverfetch({
		query,
		limit: ps.limit,
		pagination: ps,
		me: user,
	});
});
