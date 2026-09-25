/**
 * @packageDocumentation
 *
 * 絵文字の追加申請を却下する（管理者・モデレーター向け）。
 *
 * @remarks
 * 審査待ちか修正のお願い中の申請を却下できる。理由は任意で、申請者への通知に入れる。
 * インポート申請と違い、却下した絵文字名を「否認リスト」には入れない（同じ名前でも描き直して申請できるようにするため）。
 *
 * @public
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { appendHistory, notifyAddRequestRequester } from "@/services/emoji-add-request.js";
import { emojiAddRequestErrors } from "../../common/emoji-add-request-errors.js";

export const meta = {
	tags: ["emoji-add-request", "admin"],
	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:emoji",
	errors: {
		noSuchRequest: emojiAddRequestErrors.noSuchRequest,
		invalidStatus: emojiAddRequestErrors.invalidStatus,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		requestId: { type: "string", format: "misskey:id" },
		reason: { type: "string", nullable: true, maxLength: 4096 },
	},
	required: ["requestId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const request = await EmojiAddRequests.findOneBy({ id: ps.requestId });
	if (request == null) throw new ApiError(meta.errors.noSuchRequest);
	if (request.status !== "pending" && request.status !== "changesRequested") {
		throw new ApiError(meta.errors.invalidStatus);
	}

	const reason = ps.reason?.trim() || null;
	const now = new Date();
	await EmojiAddRequests.update(request.id, {
		status: "rejected",
		reviewerId: me.id,
		reviewComment: reason,
		processedAt: now,
		updatedAt: now,
		history: appendHistory(request.history, { by: me.id, action: "rejected", comment: reason }),
	});

	insertModerationLog(me, "emojiAddRequestReject", { requestId: request.id, reason });

	// 理由は、押して開く詳細で見せる（R6）
	notifyAddRequestRequester(
		request,
		"絵文字の追加申請が見送られました",
		`${request.name} の追加申請は見送られました。\nタップして確認してください。`,
	);
});
