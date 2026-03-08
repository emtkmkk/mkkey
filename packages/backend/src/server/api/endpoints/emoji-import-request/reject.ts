/**
 * 絵文字インポート申請を否認する。否認リストに登録し、申請者に通知する。
 *
 * @public
 */
import define from "../../define.js";
import { EmojiImportRequests, EmojiImportDenieds } from "@/models/index.js";
import { ApiError } from "../../error.js";
import { createNotification } from "@/services/create-notification.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import config from "@/config/index.js";

export const meta = {
	tags: ["emoji-import-request", "admin"],
	requireCredential: true,
	requireModerator: true,
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
	if (request.status !== "pending") {
		throw new ApiError(meta.errors.alreadyProcessed);
	}

	const reason = ps.reason?.trim() ?? null;

	await EmojiImportRequests.update(request.id, {
		status: "rejected",
		reason,
		processedById: me.id,
		processedAt: new Date(),
	});

	const exists = await EmojiImportDenieds.findOneBy({ name: request.emojiName });
	if (!exists) {
		await EmojiImportDenieds.insert({ name: request.emojiName });
	}

	const body =
		`:${request.emojiName}@${request.emojiHost}: の申請は見送られました。` +
		(reason ? `\n\n理由: ${reason}` : "");
	const meta = await fetchMeta();
	const iconUrl =
		meta?.iconUrl != null
			? meta.iconUrl.startsWith("http")
				? meta.iconUrl
				: `${config.url}${meta.iconUrl.startsWith("/") ? "" : "/"}${meta.iconUrl}`
			: undefined;
	createNotification(request.requesterId, "app", {
		customHeader: "絵文字インポート申請が見送られました",
		customBody: body,
		customIcon: iconUrl,
	});

	insertModerationLog(me, "emojiImportRequestReject", {
		requestId: request.id,
		emojiName: request.emojiName,
		emojiHost: request.emojiHost,
		reason: reason ?? undefined,
	});

	return {};
});
