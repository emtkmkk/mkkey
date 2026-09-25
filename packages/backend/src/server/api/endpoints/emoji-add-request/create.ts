/**
 * @packageDocumentation
 *
 * 絵文字の追加申請を作る（ユーザー向け）。
 *
 * @remarks
 * - 画像は申請者のドライブのファイルを指定してもらい、サーバー側（持ち主なし）へ複製してから申請に紐づける（B3）。
 *   申請者があとで自分のドライブから消しても承認できるようにするため。
 * - 同じ名前の申請や、同じ名前の絵文字があっても受け付ける（B4。名前は承認時に管理者が直せる）。
 * - 件数の上限は設けない（当面）。
 * - 申請が届いたら、管理者（isAdmin）に通知する。
 *
 * @public
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests, DriveFiles } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import {
	appendHistory,
	applyAskContactRule,
	emojiAddRequestFieldsParamDef,
	findEmojiAddRequestProblem,
	normalizeEmojiAddRequestFields,
	notifyAddRequestReviewers,
} from "@/services/emoji-add-request.js";
import type { EmojiAddRequestEditableFields } from "@/models/entities/emoji-add-request.js";
import {
	emojiAddRequestErrors,
	throwIfEmojiAddRequestProblem,
} from "../../common/emoji-add-request-errors.js";

export const meta = {
	tags: ["emoji-add-request"],
	requireCredential: true,
	kind: "write:account",
	errors: {
		noSuchFile: emojiAddRequestErrors.noSuchFile,
		notImage: emojiAddRequestErrors.notImage,
		copyFailed: emojiAddRequestErrors.copyFailed,
		invalidName: emojiAddRequestErrors.invalidName,
		motifRequired: emojiAddRequestErrors.motifRequired,
		usageInfoRequired: emojiAddRequestErrors.usageInfoRequired,
	},
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			id: { type: "string", format: "id" },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		...emojiAddRequestFieldsParamDef,
		/** 申請画面か MEGAMOJI 経由か */
		source: { type: "string", enum: ["form", "megamoji"], default: "form" },
		/** 申請者から承認者へのメッセージ */
		message: { type: "string", nullable: true, maxLength: 4096 },
		/** 申請画面で余白カット・縮小をしたか。したときは加工前の幅・高さも送る */
		imageProcessed: { type: "boolean", default: false },
		originalWidth: { type: "integer", nullable: true, minimum: 1 },
		originalHeight: { type: "integer", nullable: true, minimum: 1 },
	},
	required: ["fileId", "name"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// #region 画像の確認と複製
	const userFile = await DriveFiles.findOneBy({ id: ps.fileId, userId: me.id });
	if (userFile == null) throw new ApiError(meta.errors.noSuchFile);
	if (!userFile.type.startsWith("image/")) throw new ApiError(meta.errors.notImage);

	let copied;
	try {
		// 持ち主なし（サーバー側）として取り込み直す。インポート申請の承認と同じやり方
		copied = await uploadFromUrl({ url: userFile.url, user: null, force: true });
	} catch {
		throw new ApiError(meta.errors.copyFailed);
	}
	// #endregion

	// #region 入力の検査
	const input = normalizeEmojiAddRequestFields(ps);
	const fields: EmojiAddRequestEditableFields = applyAskContactRule({
		name: input.name ?? "",
		alternateName: input.alternateName ?? null,
		ruby: input.ruby ?? null,
		description: input.description ?? null,
		category: input.category ?? null,
		aliases: input.aliases ?? [],
		sensitive: input.sensitive ?? false,
		isTextOnly: input.isTextOnly ?? false,
		motifSelf: input.motifSelf ?? null,
		motifUserMode: input.motifUserMode ?? null,
		copyPermission: input.copyPermission ?? "none",
		askContact: input.askContact ?? null,
		licenseName: input.licenseName ?? null,
		creator: input.creator ?? null,
		usageInfo: input.usageInfo ?? null,
		copyrightNotice: input.copyrightNotice ?? null,
		creditText: input.creditText ?? null,
		relatedLinks: input.relatedLinks ?? [],
		fileId: copied.id,
	});
	throwIfEmojiAddRequestProblem(findEmojiAddRequestProblem(fields));
	// #endregion

	const now = new Date();
	const request = await EmojiAddRequests.insert({
		id: genId(),
		createdAt: now,
		updatedAt: now,
		status: "pending",
		source: ps.source === "megamoji" ? "megamoji" : "form",
		requesterId: me.id,
		imageProcessed: ps.imageProcessed ?? false,
		originalWidth: ps.imageProcessed ? (ps.originalWidth ?? null) : null,
		originalHeight: ps.imageProcessed ? (ps.originalHeight ?? null) : null,
		...fields,
		message: ps.message?.trim() || null,
		proposal: null,
		reviewComment: null,
		reviewerId: null,
		processedAt: null,
		approvedEmojiId: null,
		history: appendHistory([], { by: me.id, action: "created" }),
	}).then((x) => EmojiAddRequests.findOneByOrFail(x.identifiers[0]));

	notifyAddRequestReviewers(
		request,
		"絵文字の追加申請がありました",
		`${request.name} の追加申請が届きました。\nタップして確認してください。`,
	);

	return { id: request.id };
});
