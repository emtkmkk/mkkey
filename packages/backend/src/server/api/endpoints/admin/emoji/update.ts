/**
 * 絵文字更新 API
 *
 * @remarks
 * isTextOnly が true のときは copyPermission / licenseName / creator は固定値で上書き（リクエストの値は無視）。
 * 更新後: private なら emojiDeleted、非公開→公開なら emojiAdded、それ以外の公開なら emojiUpdated をストリーム送信。
 */
import { IsNull } from "typeorm";
import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { getEffectiveUsageVisibility } from "@/models/repositories/emoji.js";
import { toStoredCopyPermission } from "@/misc/copy-permission.js";
import { ApiError } from "../../../error.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { db } from "@/db/postgre.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";

const COPY_PERMISSION_VALUES = ["allow", "deny", "conditional", "none"] as const;

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	errors: {
		noSuchEmoji: {
			message: "その絵文字は存在しません。",
			code: "NO_SUCH_EMOJI",
			id: "684dec9d-a8c2-4364-9aa8-456c49cb1dc8",
		},
		duplicateEmojiName: {
			message: "絵文字名が重複しています。",
			code: "DUPLICATE_EMOJI_NAME",
			id: "a7f2bc3d-b1c2-4678-b023-9f8c5d4e2abc",
		},
		invalidCopyPermission: {
			message: "copyPermission は allow / deny / conditional / none のいずれかを指定してください。",
			code: "INVALID_COPY_PERMISSION",
			id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		id: { type: "string", format: "misskey:id" },
		name: { type: "string" },
		category: {
			type: "string",
			nullable: true,
			description: "Use `null` to reset the category.",
		},
		aliases: {
			type: "array",
			items: {
				type: "string",
			},
		},
		copyPermission: {
			type: "string",
			nullable: true,
			enum: COPY_PERMISSION_VALUES,
		},
		licenseName: { type: "string", nullable: true },
		usageInfo: { type: "string", nullable: true },
		creator: { type: "string", nullable: true },
		description: { type: "string", nullable: true },
		isBasedOnUrl: { type: "string", nullable: true },
		license: {
			type: "string",
			nullable: true,
			description: "ライセンス補足情報",
		},
		isTextOnly: { type: "boolean", nullable: true },
		sensitive: { type: "boolean", nullable: true },
		usageVisibility: {
			type: "string",
			nullable: true,
			enum: ["public", "limited", "user", "private"],
		},
		allowedUserIds: {
			type: "array",
			items: { type: "string", format: "misskey:id" },
			nullable: true,
		},
		motifUserId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
		},
		motifUserMode: {
			type: "string",
			nullable: true,
			enum: ["any", "follow", "owner"],
		},
	},
	required: ["id", "name", "aliases"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const emoji = await Emojis.findOneBy({ id: ps.id });

	if (emoji == null) throw new ApiError(meta.errors.noSuchEmoji);

	if (
		ps.copyPermission != null &&
		!COPY_PERMISSION_VALUES.includes(ps.copyPermission as typeof COPY_PERMISSION_VALUES[number])
	) {
		throw new ApiError(meta.errors.invalidCopyPermission);
	}

	const emojiSearchName = await Emojis.findOneBy({
		name: ps.name.toLowerCase(),
		host: IsNull(),
	});

	// 名前重複の場合
	if (emojiSearchName && emojiSearchName.id !== emoji.id) {
		throw new ApiError(meta.errors.duplicateEmojiName);
	}

	const wasPrivate = getEffectiveUsageVisibility(emoji) === "private";

	const isTextOnly = ps.isTextOnly ?? emoji.isTextOnly;
	const update: Record<string, unknown> = {
		updatedAt: new Date(),
		name: ps.name.toLowerCase(),
		category: ps.category,
		aliases: ps.aliases,
		isTextOnly,
		sensitive: ps.sensitive ?? emoji.sensitive,
		usageInfo: ps.usageInfo ?? emoji.usageInfo,
		description: ps.description ?? emoji.description,
		isBasedOnUrl: ps.isBasedOnUrl ?? emoji.isBasedOnUrl,
		license: ps.license ?? emoji.license,
	};
	if (ps.usageVisibility !== undefined) update.usageVisibility = ps.usageVisibility;
	if (ps.allowedUserIds !== undefined) update.allowedUserIds = ps.allowedUserIds;
	if (ps.motifUserId !== undefined) update.motifUserId = ps.motifUserId;
	if (ps.motifUserMode !== undefined) update.motifUserMode = ps.motifUserMode;
	if (isTextOnly) {
		update.copyPermission = toStoredCopyPermission("allow");
		update.licenseName = "CC0 1.0 Universal";
		update.creator = null;
	} else {
		update.copyPermission = toStoredCopyPermission(ps.copyPermission ?? emoji.copyPermission);
		update.licenseName = ps.licenseName ?? emoji.licenseName;
		update.creator = ps.creator ?? emoji.creator;
	}

	await Emojis.update(emoji.id, update);

	const pack = await Emojis.pack(emoji.id);
	const nowPrivate = pack.usageVisibility === "private";

	if (nowPrivate) {
		publishBroadcastStream("emojiDeleted", {
			emoji: pack,
			emojis: [pack],
		});
	} else if (wasPrivate) {
		publishBroadcastStream("emojiAdded", {
			emoji: pack,
		});
	} else {
		publishBroadcastStream("emojiUpdated", {
			emoji: pack,
			emojis: [pack],
		});
	}

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();
});
