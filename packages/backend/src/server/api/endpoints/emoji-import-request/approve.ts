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
import { fetchMeta } from "@/misc/fetch-meta.js";
import config from "@/config/index.js";
import { publishBroadcastStream } from "@/services/stream.js";

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

	// 名前が指定されている場合は重複がなくてもその名前で登録する
	if (newName && !localSameName) {
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
		!newName &&
		(await Emojis.findOneBy({
			name: emoji.name,
			host: IsNull(),
		}));
	const finalName = newName
		? newName
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

	// license = 「Copy to {host}」＋元の license（「コピー元 : …」は除去）。コピー元は isBasedOnUrl に格納するためここには含めない。
	const sourceHost = emoji.host ?? "unknown";
	const license =
		`Copy to ${sourceHost}` +
		(emoji.license
			? `, ${emoji.license.replace(/コピー元 : ([^,]+)(,|$)/, "")}`
			: "");

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
		license,
		isTextOnly: false,
		sensitive: emoji.sensitive ?? false,
		usageVisibility: "public",
		allowedUserIds: [],
		motifUserId: null,
		motifUserMode: "any",
	}).then((x) => Emojis.findOneByOrFail(x.identifiers[0]));

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();
	publishBroadcastStream("emojiAdded", {
		emoji: await Emojis.pack(copied.id),
	});

	await EmojiImportRequests.update(request.id, {
		status: "approved",
		processedById: me.id,
		importedEmojiId: copied.id,
		processedAt: new Date(),
	});

	await EmojiImportDenieds.delete({ name: request.emojiName }).catch(() => {});

	const m = await fetchMeta();
	const iconUrl =
		m?.iconUrl != null
			? m.iconUrl.startsWith("http")
				? m.iconUrl
				: `${config.url}${m.iconUrl.startsWith("/") ? "" : "/"}${m.iconUrl}`
			: undefined;
	createNotification(request.requesterId, "app", {
		customHeader: "絵文字インポート申請が承認されました",
		customBody: `申請していた :${request.emojiName}@${request.emojiHost}: がサーバーに追加されました。`,
		customIcon: iconUrl,
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
