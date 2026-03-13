/**
 * @packageDocumentation
 *
 * 認証ユーザーの未読ノートをすべて既読にする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/read-all-unread-notes`（POST `/api/i/read-all-unread-notes` で呼び出し）
 * - 認証必須。自分向けの未読ノートを一括で既読にする。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { publishMainStream } from "@/services/stream.js";
import define from "../../define.js";
import { NoteUnreads } from "@/models/index.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:account",
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// ドキュメントを削除する
	await NoteUnreads.delete({
		userId: user.id,
	});

	// 全て既読になったイベントを発行
	publishMainStream(user.id, "readAllUnreadMentions");
	publishMainStream(user.id, "readAllUnreadSpecifiedNotes");
});
