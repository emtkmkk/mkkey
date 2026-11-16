/**
 * @packageDocumentation
 *
 * 絵文字インポート申請を承認する。内部で admin/emoji/copy 相当の処理を行い、同名がローカルに既にある場合は newEmojiName で登録する。
 *
 * @remarks
 * - Fedibird 互換項目とコピー元のカテゴリ（orgCategory）も admin/emoji/copy と同じく引き継ぐ。
 * - 審査待ちのほか、却下済みの申請も承認できる（判断の取り消し）。遷移表は `@/misc/emoji-request-state.js`。
 * - 状態の書き換えと絵文字の登録は 1 つのトランザクションで行い、状態を先に書き換える。
 *   二重に承認ボタンが押されても、絵文字は 1 つしか登録されない（負けた方は alreadyProcessed）。
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
import { notifyEmojiRequestRequester } from "@/services/emoji-request-notification.js";
import { buildCopiedEmojiExtraFields } from "@/misc/emoji-fedibird.js";
import { ApiError } from "../../error.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import { clearEmojiQueryCache } from "@/misc/emoji-query-cache.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { db } from "@/db/postgre.js";
import { Emoji } from "@/models/entities/emoji.js";
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
	// 画像の複製など重い処理の前に、早めに断る（最終判定はトランザクション内の書き換え）
	if (!canEmojiImportRequest("approve", request.status)) {
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
		? `${emoji.name}_${request.emojiHost.replaceAll(/[^\w]/gi, "_")}`
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

	// 申請に importedEmojiId を先に書くため、ID はここで決めておく
	const copiedId = genId();
	const now = new Date();
	const row: Partial<Emoji> = {
		id: copiedId,
		createdAt: now,
		updatedAt: now,
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
		// 表示名・読み・関連リンク・著作権表示・クレジット・コピー元のカテゴリも引き継ぐ
		...buildCopiedEmojiExtraFields(emoji),
		isTextOnly: false,
		sensitive: emoji.sensitive ?? false,
		usageVisibility: "public",
		allowedUserIds: [],
		motifUserId: null,
		motifUserMode: "any",
	};

	// #region 状態の書き換えと絵文字の登録（まとめて成功するか、まとめて取り消す）
	await db.transaction(async (manager) => {
		const done = await transitionEmojiImportRequest("approve", request.id, {
			processedById: me.id,
			importedEmojiId: copiedId,
			processedAt: now,
		}, manager);
		// ほかの管理者が先に承認していた。何も登録せずに終える
		if (!done) throw new ApiError(meta.errors.alreadyProcessed);

		await manager.getRepository(Emoji).insert(row);
	});
	// #endregion

	// 確定したあとで、キャッシュを捨てて全体に知らせる（取り消しになった登録を知らせないため）
	const copied = await Emojis.findOneByOrFail({ id: copiedId });
	await clearEmojiQueryCache();
	await bumpReactionNormalizeCacheVersion();
	publishBroadcastStream("emojiAdded", {
		emoji: await Emojis.pack(copied.id),
	});

	await EmojiImportDenieds.delete({ name: request.emojiName }).catch(() => {});

	// 通知の種類は emojiRequest。押すと自分の申請の詳細が開く
	notifyEmojiRequestRequester(request.requesterId, {
		kind: "import",
		requestId: request.id,
		header: "絵文字インポート申請が承認されました",
		body: `申請していた :${finalName}: がサーバーに追加されました。`,
		icon: copied.publicUrl || copied.originalUrl,
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
