/**
 * @packageDocumentation
 *
 * 「修正のお願い」を受けた追加申請を、出し直す（ユーザー向け）。
 *
 * @remarks
 * 申請者は次のどちらかで出し直す（R2）。
 * - acceptProposal: true … 管理者の修正案をそのまま受け入れる（「この内容で再申請」）
 * - それ以外 … 申請画面で直した全項目を送る（「自分で直して再申請」）
 *
 * 画像を選び直したときは、申請者のドライブのファイル ID が届くので、作成時と同じくサーバー側へ複製する。
 * 今の申請や修正案の画像と同じ ID なら、そのまま使う。
 * 出し直すと状態は「審査待ち」に戻り、修正案とコメントは消す（経緯には残っている）。管理者に通知する。
 *
 * @public
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests, DriveFiles } from "@/models/index.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import {
	appendHistory,
	applyAskContactRule,
	emojiAddRequestFieldsParamDef,
	findEmojiAddRequestProblem,
	normalizeEmojiAddRequestFields,
	notifyAddRequestReviewers,
	pickEditableFields,
} from "@/services/emoji-add-request.js";
import {
	emojiAddRequestErrors,
	throwIfEmojiAddRequestProblem,
} from "../../common/emoji-add-request-errors.js";

export const meta = {
	tags: ["emoji-add-request"],
	requireCredential: true,
	kind: "write:account",
	errors: {
		noSuchRequest: emojiAddRequestErrors.noSuchRequest,
		invalidStatus: emojiAddRequestErrors.invalidStatus,
		noSuchFile: emojiAddRequestErrors.noSuchFile,
		notImage: emojiAddRequestErrors.notImage,
		copyFailed: emojiAddRequestErrors.copyFailed,
		invalidName: emojiAddRequestErrors.invalidName,
		motifRequired: emojiAddRequestErrors.motifRequired,
		usageInfoRequired: emojiAddRequestErrors.usageInfoRequired,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		requestId: { type: "string", format: "misskey:id" },
		acceptProposal: { type: "boolean", default: false },
		...emojiAddRequestFieldsParamDef,
		message: { type: "string", nullable: true, maxLength: 4096 },
		imageProcessed: { type: "boolean" },
		originalWidth: { type: "integer", nullable: true, minimum: 1 },
		originalHeight: { type: "integer", nullable: true, minimum: 1 },
	},
	required: ["requestId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const request = await EmojiAddRequests.findOneBy({ id: ps.requestId, requesterId: me.id });
	if (request == null) throw new ApiError(meta.errors.noSuchRequest);
	if (request.status !== "changesRequested") throw new ApiError(meta.errors.invalidStatus);

	const current = pickEditableFields(request);
	let next = { ...current };
	let imagePatch: Partial<typeof request> = {};

	if (ps.acceptProposal) {
		// 管理者の修正案をそのまま当てる
		next = { ...current, ...(request.proposal ?? {}) };
	} else {
		next = { ...current, ...normalizeEmojiAddRequestFields(ps) };

		// 画像を選び直したときだけ、申請者のファイルを複製する
		const knownFileIds = [request.fileId, request.proposal?.fileId].filter(Boolean);
		if (ps.fileId && !knownFileIds.includes(ps.fileId)) {
			const userFile = await DriveFiles.findOneBy({ id: ps.fileId, userId: me.id });
			if (userFile == null) throw new ApiError(meta.errors.noSuchFile);
			if (!userFile.type.startsWith("image/")) throw new ApiError(meta.errors.notImage);
			try {
				const copied = await uploadFromUrl({ url: userFile.url, user: null, force: true });
				next.fileId = copied.id;
			} catch {
				throw new ApiError(meta.errors.copyFailed);
			}
		}
		if (ps.imageProcessed !== undefined) {
			imagePatch = {
				imageProcessed: ps.imageProcessed,
				originalWidth: ps.imageProcessed ? (ps.originalWidth ?? null) : null,
				originalHeight: ps.imageProcessed ? (ps.originalHeight ?? null) : null,
			};
		}
	}

	next = applyAskContactRule(next);
	throwIfEmojiAddRequestProblem(findEmojiAddRequestProblem(next));

	await EmojiAddRequests.update(request.id, {
		...next,
		...imagePatch,
		...(ps.message !== undefined ? { message: ps.message?.trim() || null } : {}),
		status: "pending",
		proposal: null,
		reviewComment: null,
		updatedAt: new Date(),
		history: appendHistory(request.history, { by: me.id, action: "resubmitted" }),
	});

	notifyAddRequestReviewers(
		{ id: request.id, fileId: next.fileId, requesterId: request.requesterId },
		"絵文字の追加申請が出し直されました",
		`${next.name} の追加申請が、修正のお願いを受けて出し直されました。\nタップして確認してください。`,
	);
});
