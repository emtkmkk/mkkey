/**
 * 絵文字インポート申請を承認する。内部で admin/emoji/copy 相当の処理を行い、同名がローカルに既にある場合は newEmojiName で登録する。
 *
 * @public
 */
import { IsNull } from "typeorm";
import define from "../../define.js";
import {
	EmojiImportRequests,
	EmojiImportDenieds,
	Emojis,
} from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { ApiError } from "../../error.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import { db } from "@/db/postgre.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";
import { createNotification } from "@/services/create-notification.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";

export const meta = {
	tags: ["emoji-import-request", "admin"],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchRequest: {
			message: "その申請は存在しません。",
			code: "NO_SUCH_REQUEST",
			id: "b1c2d3e4-no-such-request",
		},
		alreadyProcessed: {
			message: "その申請は既に処理済みです。",
			code: "ALREADY_PROCESSED",
			id: "b1c2d3e4-already-processed",
		},
		newEmojiNameRequired: {
			message: "同名の絵文字がローカルに存在するため、重複しない新絵文字名を指定してください。",
			code: "NEW_EMOJI_NAME_REQUIRED",
			id: "b1c2d3e4-new-name-required",
		},
		newEmojiNameConflict: {
			message: "指定した絵文字名は既に使用されています。",
			code: "NEW_EMOJI_NAME_CONFLICT",
			id: "b1c2d3e4-new-name-conflict",
		},
		noSuchEmoji: {
			message: "その絵文字は存在しません。",
			code: "NO_SUCH_EMOJI",
			id: "b1c2d3e4-no-such-emoji",
		},
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
		requestId: { type: "string", format: "misskey:id" },
		newEmojiName: { type: "string", minLength: 1, maxLength: 128, nullable: true },
	},
	required: ["requestId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const request = await EmojiImportRequests.findOneBy({ id: ps.requestId });
	if (!request) {
		throw new ApiError(meta.errors.noSuchRequest);
	}
	if (request.status === "approved") {
		throw new ApiError(meta.errors.alreadyProcessed);
	}

	const emoji = await Emojis.findOneBy({
		name: request.emojiName,
		host: request.emojiHost,
	});
	if (!emoji) {
		throw new ApiError(meta.errors.noSuchEmoji);
	}

	const localSameName = await Emojis.findOneBy({
		name: request.emojiName,
		host: IsNull(),
	});

	const newName = ps.newEmojiName?.trim();
	if (localSameName) {
		if (!newName) {
			throw new ApiError(meta.errors.newEmojiNameRequired);
		}
		const conflict = await Emojis.findOneBy({
			name: newName,
			host: IsNull(),
		});
		if (conflict) {
			throw new ApiError(meta.errors.newEmojiNameConflict);
		}
	}

	let driveFile: DriveFile;
	try {
		driveFile = await uploadFromUrl({
			url: emoji.originalUrl,
			user: null,
			force: true,
		});
	} catch {
		throw new ApiError();
	}

	const emojiSearchName =
		!localSameName &&
		(await Emojis.findOneBy({
			name: emoji.name,
			host: IsNull(),
		}));
	const finalName = localSameName
		? newName!
		: emojiSearchName
		? `${emoji.name}_${emoji.host.replaceAll(/[^\w]/gi, "_")}`
		: emoji.name;

	const existingWithFinalName = await Emojis.findOneBy({
		name: finalName,
		host: IsNull(),
	});
	if (existingWithFinalName) {
		throw new ApiError({
			message: "Already Registered.",
			code: "ALREADY_REGISTERED",
			id: "e2785b66-dca3-4087-9cac-ad17432b63f1",
		});
	}

	const sourceHost = emoji.host ?? "unknown";
	const copied = await Emojis.insert({
		id: genId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		name: finalName,
		host: null,
		aliases: emoji.aliases ?? [],
		originalUrl: driveFile.url,
		publicUrl: driveFile.webpublicUrl ?? driveFile.url,
		type: driveFile.webpublicType ?? driveFile.type,
		copyPermission: emoji.copyPermission ?? null,
		licenseName: emoji.licenseName ?? null,
		usageInfo: emoji.usageInfo ?? null,
		creator: emoji.creator ?? null,
		description: emoji.description ?? null,
		isBasedOnUrl: emoji.uri ?? null,
		license: `Copy to ${sourceHost}`,
		isTextOnly: false,
		sensitive: emoji.sensitive ?? false,
		usageVisibility: "public",
		allowedUserIds: [],
		motifUserId: null,
		motifUserMode: "any",
	}).then((x) => Emojis.findOneByOrFail(x.identifiers[0]));

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();

	await EmojiImportRequests.update(request.id, {
		status: "approved",
		processedById: me.id,
		importedEmojiId: copied.id,
		processedAt: new Date(),
	});

	await EmojiImportDenieds.delete({ name: request.emojiName }).catch(() => {});

	createNotification(request.requesterId, "app", {
		customHeader: "絵文字インポート申請が承認されました",
		customBody: `:${finalName}: がサーバーに追加されました。`,
	});

	insertModerationLog(me, "emojiImportRequestApprove", {
		requestId: request.id,
		emojiName: request.emojiName,
		emojiHost: request.emojiHost,
		importedEmojiId: copied.id,
		importedEmojiName: finalName,
	});

	return { id: copied.id };
});
