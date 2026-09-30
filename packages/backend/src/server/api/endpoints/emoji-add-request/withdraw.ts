/**
 * @packageDocumentation
 *
 * 自分の追加申請を取り下げる（ユーザー向け）。
 *
 * @remarks
 * 審査待ちか、修正のお願い中の申請だけ取り下げられる。取り下げた申請は消さずに「取り下げ」として残す。
 *
 * @public
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests } from "@/models/index.js";
import { appendHistory } from "@/services/emoji-add-request.js";
import { emojiAddRequestErrors } from "../../common/emoji-add-request-errors.js";

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
	if (request.status !== "pending" && request.status !== "changesRequested") {
		throw new ApiError(meta.errors.invalidStatus);
	}

	const now = new Date();
	await EmojiAddRequests.update(request.id, {
		status: "withdrawn",
		processedAt: now,
		updatedAt: now,
		history: appendHistory(request.history, { by: me.id, action: "withdrawn" }),
	});
});
