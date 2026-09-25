/**
 * @packageDocumentation
 *
 * 絵文字の追加申請に「修正のお願い」をする（管理者・モデレーター向け）。
 *
 * @remarks
 * - 管理者が直した項目（修正案）とコメントを申請に入れ、状態を「修正のお願い中」にする（R2）。
 * - 申請の入力そのものは変えない。申請者が「この内容で再申請」を選んだときに修正案を当てる。
 * - 修正案が無くても、コメントだけでお願いできる（例：画像を描き直してほしい）。どちらも無ければエラー。
 * - 画像を差し替える修正案では、管理者のドライブのファイルをサーバー側へ複製してから入れる。
 * - 申請者に通知する。申請者が反応しなくても自動では取り下げない（R3）。
 *
 * @public
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests, DriveFiles } from "@/models/index.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import {
	appendHistory,
	applyAskContactRule,
	diffEditableFields,
	emojiAddRequestFieldsParamDef,
	findEmojiAddRequestProblem,
	normalizeEmojiAddRequestFields,
	notifyAddRequestRequester,
	pickEditableFields,
} from "@/services/emoji-add-request.js";
import {
	emojiAddRequestErrors,
	throwIfEmojiAddRequestProblem,
} from "../../common/emoji-add-request-errors.js";

export const meta = {
	tags: ["emoji-add-request", "admin"],
	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:emoji",
	errors: {
		noSuchRequest: emojiAddRequestErrors.noSuchRequest,
		invalidStatus: emojiAddRequestErrors.invalidStatus,
		noSuchFile: emojiAddRequestErrors.noSuchFile,
		notImage: emojiAddRequestErrors.notImage,
		copyFailed: emojiAddRequestErrors.copyFailed,
		invalidName: emojiAddRequestErrors.invalidName,
		motifRequired: emojiAddRequestErrors.motifRequired,
		usageInfoRequired: emojiAddRequestErrors.usageInfoRequired,
		noChanges: emojiAddRequestErrors.noChanges,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		requestId: { type: "string", format: "misskey:id" },
		/** 修正案（変えるものだけ） */
		...emojiAddRequestFieldsParamDef,
		/** 申請者へのコメント */
		comment: { type: "string", nullable: true, maxLength: 4096 },
	},
	required: ["requestId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const request = await EmojiAddRequests.findOneBy({ id: ps.requestId });
	if (request == null) throw new ApiError(meta.errors.noSuchRequest);
	if (request.status !== "pending") throw new ApiError(meta.errors.invalidStatus);

	const before = pickEditableFields(request);
	const input = normalizeEmojiAddRequestFields(ps);
	if (input.fileId && input.fileId !== request.fileId) {
		const adminFile = await DriveFiles.findOneBy({ id: input.fileId, userId: me.id });
		if (adminFile == null) throw new ApiError(meta.errors.noSuchFile);
		if (!adminFile.type.startsWith("image/")) throw new ApiError(meta.errors.notImage);
		try {
			input.fileId = (await uploadFromUrl({ url: adminFile.url, user: null, force: true })).id;
		} catch {
			throw new ApiError(meta.errors.copyFailed);
		}
	}
	const after = applyAskContactRule({ ...before, ...input });
	throwIfEmojiAddRequestProblem(findEmojiAddRequestProblem(after));
	const proposal = diffEditableFields(before, after);
	const comment = ps.comment?.trim() || null;
	if (Object.keys(proposal).length === 0 && comment == null) {
		throw new ApiError(meta.errors.noChanges);
	}

	await EmojiAddRequests.update(request.id, {
		status: "changesRequested",
		proposal: Object.keys(proposal).length > 0 ? proposal : null,
		reviewComment: comment,
		reviewerId: me.id,
		updatedAt: new Date(),
		history: appendHistory(request.history, {
			by: me.id,
			action: "changesRequested",
			comment,
			changes: proposal,
		}),
	});

	insertModerationLog(me, "emojiAddRequestChangesRequested", {
		requestId: request.id,
		changed: Object.keys(proposal),
	});

	// 修正案とコメントは、押して開く詳細で見せる（R6）
	notifyAddRequestRequester(
		request,
		"絵文字の追加申請に修正のお願いがあります",
		`${request.name} の申請について、管理者から修正のお願いが届きました。\nタップして確認してください。`,
	);
});
