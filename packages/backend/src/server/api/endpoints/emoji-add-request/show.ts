/**
 * @packageDocumentation
 *
 * 追加申請を 1 件取る（申請者本人と管理者向け）。
 *
 * @remarks
 * 申請の詳細ページ（`/emoji-requests/add/{id}`）と、審査画面のその申請（`/admin/emoji-requests/add/{id}`）で使う。
 * - 申請者本人は自分の申請だけを見られる
 * - モデレーター以上は誰の申請でも見られる（審査のため）
 * それ以外の人には、申請が無いときと同じエラーを返す（あるかどうかを知られないようにするため）。
 *
 * @public
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests } from "@/models/index.js";
import { packEmojiAddRequest } from "@/services/emoji-add-request.js";
import { emojiAddRequestErrors } from "../../common/emoji-add-request-errors.js";

export const meta = {
	tags: ["emoji-add-request"],
	requireCredential: true,
	kind: "read:account",
	errors: {
		noSuchRequest: emojiAddRequestErrors.noSuchRequest,
	},
	res: {
		type: "object",
		optional: false,
		nullable: false,
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
	const request = await EmojiAddRequests.findOne({
		where: { id: ps.requestId },
		relations: ["requester"],
	});
	const canReview = me.isAdmin || me.isModerator;
	if (request == null || (request.requesterId !== me.id && !canReview)) {
		throw new ApiError(meta.errors.noSuchRequest);
	}
	return await packEmojiAddRequest(request);
});
