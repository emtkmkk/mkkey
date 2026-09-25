/**
 * @packageDocumentation
 *
 * 絵文字の追加申請を承認し、絵文字として登録する（管理者・モデレーター向け）。
 *
 * @remarks
 * - 項目を渡すと「直して承認」になる（R1）。変えた項目は申請にも反映し、経緯と申請者への通知に残す。
 *   名前の重複を避けるだけのような小さな直しで、申請者に差し戻さずに済ませるため。
 * - 画像を差し替えるとき（審査画面での余白カットなど）は、管理者のドライブのファイル ID を受け取り、サーバー側へ複製して使う。
 * - 登録する絵文字の値は {@link buildEmojiRowFromRequest} で組み立てる（公開範囲は public 固定など）。
 * - 同じ名前のローカル絵文字があれば承認できない（名前を直してもらう）。
 * - 審査待ちのほか、修正のお願い中の申請も承認できる（管理者が考え直した場合）。
 *
 * @public
 */
import { IsNull } from "typeorm";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { EmojiAddRequests, DriveFiles, Emojis } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { db } from "@/db/postgre.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import {
	appendHistory,
	applyAskContactRule,
	buildEmojiRowFromRequest,
	describeChangedFields,
	diffEditableFields,
	emojiAddRequestFieldsParamDef,
	findEmojiAddRequestProblem,
	normalizeEmojiAddRequestFields,
	notifyEmojiRequester,
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
		duplicateEmojiName: emojiAddRequestErrors.duplicateEmojiName,
	},
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			emojiId: { type: "string", format: "id" },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		requestId: { type: "string", format: "misskey:id" },
		/** 直して承認するときの項目（変えるものだけ） */
		...emojiAddRequestFieldsParamDef,
		/** 申請者へのコメント（直した理由など） */
		comment: { type: "string", nullable: true, maxLength: 4096 },
	},
	required: ["requestId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const request = await EmojiAddRequests.findOneBy({ id: ps.requestId });
	if (request == null) throw new ApiError(meta.errors.noSuchRequest);
	if (request.status !== "pending" && request.status !== "changesRequested") {
		throw new ApiError(meta.errors.invalidStatus);
	}

	// #region 直した内容を当てる
	const before = pickEditableFields(request);
	const input = normalizeEmojiAddRequestFields(ps);
	if (input.fileId && input.fileId !== request.fileId) {
		// 管理者が審査画面で加工した画像など。サーバー側へ複製してから使う
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
	const changes = diffEditableFields(before, after);
	const changed = Object.keys(changes).length > 0;
	// #endregion

	// #region 登録できるか確認
	const sameName = await Emojis.findOneBy({ name: after.name, host: IsNull() });
	if (sameName) throw new ApiError(meta.errors.duplicateEmojiName);
	const file = after.fileId ? await DriveFiles.findOneBy({ id: after.fileId }) : null;
	if (file == null) throw new ApiError(meta.errors.noSuchFile);
	// #endregion

	const merged = { ...request, ...after };
	const emoji = await Emojis.insert({
		id: genId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		...buildEmojiRowFromRequest(merged, file),
	} as Parameters<typeof Emojis.insert>[0]).then((x) => Emojis.findOneByOrFail(x.identifiers[0]));

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();
	publishBroadcastStream("emojiAdded", { emoji: await Emojis.pack(emoji.id) });

	const now = new Date();
	const comment = ps.comment?.trim() || null;
	await EmojiAddRequests.update(request.id, {
		...after,
		status: "approved",
		approvedEmojiId: emoji.id,
		reviewerId: me.id,
		reviewComment: comment,
		proposal: null,
		processedAt: now,
		updatedAt: now,
		history: appendHistory(request.history, {
			by: me.id,
			action: changed ? "approvedWithChanges" : "approved",
			comment,
			...(changed ? { changes } : {}),
		}),
	});

	insertModerationLog(me, "emojiAddRequestApprove", {
		requestId: request.id,
		emojiId: emoji.id,
		changed: Object.keys(changes),
	});

	// 直して承認したときは、何を直したかを伝える（R1）
	notifyEmojiRequester(
		request.requesterId,
		"絵文字の追加申請が承認されました",
		[
			`申請していた :${after.name}: がサーバーに追加されました。`,
			changed ? `管理者が次の項目を直しています：${describeChangedFields(changes)}` : null,
			comment ? `管理者からのコメント：${comment}` : null,
		]
			.filter(Boolean)
			.join("\n"),
	);

	return { emojiId: emoji.id };
});
