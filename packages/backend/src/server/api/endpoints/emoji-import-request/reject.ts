/**
 * @packageDocumentation
 *
 * 絵文字インポート申請を否認する。否認リストに登録し、申請者に通知する。
 *
 * @remarks
 * - 通知の種類は emojiRequest（押すと自分の申請の詳細が開く）。理由は通知の本文には入れず、詳細で見せる。
 * - 審査待ちの申請だけ否認できる。遷移表は `@/misc/emoji-request-state.js`。
 *   承認と同時に押されたときは、先に状態を書き換えた方だけが通る（負けた方は alreadyProcessed）。
 *
 * @public
 */
import define from "../../define.js";
import { EmojiImportRequests, EmojiImportDenieds, Emojis } from "@/models/index.js";
import { notifyEmojiRequestRequester } from "@/services/emoji-request-notification.js";
import { ApiError } from "../../error.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { canEmojiImportRequest, transitionEmojiImportRequest } from "@/misc/emoji-request-state.js";

export const meta = {
	tags: ["emoji-import-request", "admin"],
	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:emoji",
	errors: {
		noSuchRequest: {
			message: "その申請は存在しません。",
			code: "NO_SUCH_REQUEST",
			id: "c2d3e4f5-no-such-request",
		},
		alreadyProcessed: {
			message: "その申請は既に処理済みです。",
			code: "ALREADY_PROCESSED",
			id: "c2d3e4f5-already-processed",
		},
	},
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		requestId: { type: "string", format: "misskey:id" },
		reason: { type: "string", maxLength: 2048, nullable: true, default: null },
	},
	required: ["requestId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const request = await EmojiImportRequests.findOneBy({ id: ps.requestId });
	if (!request) {
		throw new ApiError(meta.errors.noSuchRequest);
	}
	if (!canEmojiImportRequest("reject", request.status)) {
		throw new ApiError(meta.errors.alreadyProcessed);
	}

	const reason = ps.reason?.trim() ?? null;

	const done = await transitionEmojiImportRequest("reject", request.id, {
		reason,
		processedById: me.id,
		processedAt: new Date(),
	});
	// 確かめてから書くまでの間に、ほかの管理者が処理していた
	if (!done) throw new ApiError(meta.errors.alreadyProcessed);

	const exists = await EmojiImportDenieds.findOneBy({ name: request.emojiName });
	if (!exists) {
		await EmojiImportDenieds.insert({ name: request.emojiName });
	}

	// 通知の種類は emojiRequest。理由は、押して開く申請の詳細で見せる
	const remoteEmoji = await Emojis.findOneBy({ name: request.emojiName, host: request.emojiHost });
	notifyEmojiRequestRequester(request.requesterId, {
		kind: "import",
		requestId: request.id,
		header: "絵文字インポート申請が見送られました",
		body: `:${request.emojiName}@${request.emojiHost}: のインポート申請は見送られました。\nタップして確認してください。`,
		icon: remoteEmoji ? (remoteEmoji.publicUrl || remoteEmoji.originalUrl) : null,
	});

	insertModerationLog(me, "emojiImportRequestReject", {
		requestId: request.id,
		emojiName: request.emojiName,
		emojiHost: request.emojiHost,
		reason: reason ?? undefined,
	});

	return {};
});
