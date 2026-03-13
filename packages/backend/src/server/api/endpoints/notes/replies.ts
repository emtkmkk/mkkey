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
import type { User } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
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
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: { type: "string", format: "misskey:id" },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
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

	// フィルタで除外されるため要求より多めに取得し、件数が不足するとページネーションを打ち切る。
	const found = [];
	const take = Math.floor(ps.limit * 1.5);
	let skip = 0;
	while (found.length < ps.limit) {
		const notes = await query.take(take).skip(skip).getMany();
		const userMap = new Map<User["id"], User>();
		const noteMap = new Map<Note["id"], Note>();
		for (const note of notes) {
			if (note.user) userMap.set(note.user.id, note.user);
			if (note.reply) {
				noteMap.set(note.reply.id, note.reply);
				if (note.reply.user) userMap.set(note.reply.user.id, note.reply.user);
			}
			if (note.renote) {
				noteMap.set(note.renote.id, note.renote);
				if (note.renote.user) userMap.set(note.renote.user.id, note.renote.user);
			}
		}
		found.push(
			...(await Notes.packMany(notes, user, { _hint_: { userMap, noteMap } })),
		);
		skip += take;
		if (notes.length < take) break;
	}

	if (found.length > ps.limit) {
		found.length = ps.limit;
	}

	return found;
});
