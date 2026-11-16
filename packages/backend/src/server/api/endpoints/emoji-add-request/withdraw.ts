/**
 * @packageDocumentation
 *
 * 自分の追加申請を取り下げる（ユーザー向け）。
 *
 * @remarks
 * 審査待ちか、修正のお願い中の申請だけ取り下げられる（遷移表は `@/misc/emoji-request-state.js`）。
 * 取り下げた申請は消さずに「取り下げ」として残す。
 * 管理者の承認・却下と同時に押されたときは、先に状態を書き換えた方だけが通り、もう片方は invalidStatus になる。
 *
 * @public
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests } from "@/models/index.js";
import { appendHistory } from "@/services/emoji-add-request.js";
import { emojiAddRequestErrors } from "../../common/emoji-add-request-errors.js";
import { canEmojiAddRequest, transitionEmojiAddRequest } from "@/misc/emoji-request-state.js";

export const meta = {
	tags: ["emoji-add-request"],
	requireCredential: true,
	kind: "write:account",
	errors: {
		noSuchRequest: emojiAddRequestErrors.noSuchRequest,
		invalidStatus: emojiAddRequestErrors.invalidStatus,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		requestId: { type: "string", format: "misskey:id" },
	},
	required: ["requestId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const request = await EmojiAddRequests.findOneBy({ id: ps.requestId, requesterId: me.id });
	if (request == null) throw new ApiError(meta.errors.noSuchRequest);
	if (!canEmojiAddRequest("withdraw", request.status)) throw new ApiError(meta.errors.invalidStatus);

	const now = new Date();
	const done = await transitionEmojiAddRequest("withdraw", request.id, {
		processedAt: now,
		updatedAt: now,
		history: appendHistory(request.history, { by: me.id, action: "withdrawn" }),
	});
	// 確かめてから書くまでの間に、管理者が承認・却下していた
	if (!done) throw new ApiError(meta.errors.invalidStatus);
});
