/**
 * 絵文字一括ライセンス設定 API
 *
 * @remarks
 * 対象に isTextOnly が混在する場合は、isTextOnly の絵文字では copyPermission / licenseName / creator の変更を無視。混在なしで変更がすべてなくなる場合はエラー。
 * usageVisibility / allowedUserIds / motifUserId / motifUserMode の一括変更パラメータを任意で指定可能。
 */
import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { toStoredCopyPermission } from "@/misc/copy-permission.js";
import { In } from "typeorm";
import type { Emoji } from "@/models/entities/emoji.js";
import { ApiError } from "../../../error.js";
import { db } from "@/db/postgre.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";

const COPY_PERMISSION_VALUES = ["allow", "deny", "conditional", "none"] as const;

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	errors: {
		invalidCopyPermission: {
			message: "copyPermission は allow / deny / conditional / none のいずれかを指定してください。",
			code: "INVALID_COPY_PERMISSION",
			id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
		},
		noEffectiveChange: {
			message: "文字だけ絵文字のみが対象で、変更可能な項目に変更がありません。",
			code: "NO_EFFECTIVE_CHANGE",
			id: "d4e5f6a7-b8c9-0123-def0-234567890123",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		ids: {
			type: "array",
			items: {
				type: "string",
				format: "misskey:id",
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
		motifUserId: { type: "string", format: "misskey:id", nullable: true },
		motifUserMode: {
			type: "string",
			nullable: true,
			enum: ["any", "follow", "owner"],
		},
	},
	required: ["ids"],
} as const;

export default define(meta, paramDef, async (ps) => {
	if (
		ps.copyPermission != null &&
		!COPY_PERMISSION_VALUES.includes(ps.copyPermission as typeof COPY_PERMISSION_VALUES[number])
	) {
		throw new ApiError(meta.errors.invalidCopyPermission);
	}

	const emojis = await Emojis.findBy({
		id: In(ps.ids),
	});

	const hasTextOnly = emojis.some((e) => e.isTextOnly);
	const hasNonTextOnly = emojis.some((e) => !e.isTextOnly);
	const mixed = hasTextOnly && hasNonTextOnly;
	const allTextOnly = emojis.length > 0 && emojis.every((e) => e.isTextOnly);

	// 混在なし & すべて文字だけ & isTextOnly を OFF にしない → 変更可能な項目だけ見て、何も変わるものがなければエラー
	if (!mixed && allTextOnly && ps.isTextOnly !== false) {
		const hasEditableChange =
			ps.usageInfo !== undefined ||
			ps.description !== undefined ||
			ps.isBasedOnUrl !== undefined ||
			ps.license !== undefined ||
			ps.isTextOnly === true;
		if (!hasEditableChange) {
			throw new ApiError(meta.errors.noEffectiveChange);
		}
	}

	const now = new Date();
	for (const emoji of emojis) {
		const isTextOnly = ps.isTextOnly ?? emoji.isTextOnly;
		const update: Partial<Emoji> = {
			updatedAt: now,
			usageInfo: ps.usageInfo ?? emoji.usageInfo,
			description: ps.description ?? emoji.description,
			isBasedOnUrl: ps.isBasedOnUrl ?? emoji.isBasedOnUrl,
			license: ps.license ?? emoji.license,
			isTextOnly,
			sensitive: ps.sensitive ?? emoji.sensitive,
		};
		if (emoji.isTextOnly && isTextOnly) {
			// 文字だけのまま: 固定 3 項目は更新しない
		} else if (isTextOnly) {
			update.copyPermission = toStoredCopyPermission("allow");
			update.licenseName = "CC0 1.0 Universal";
			update.creator = null;
		} else {
			update.copyPermission = toStoredCopyPermission(ps.copyPermission ?? emoji.copyPermission);
			update.licenseName = ps.licenseName ?? emoji.licenseName;
			update.creator = ps.creator ?? emoji.creator;
		}
		if (ps.usageVisibility !== undefined) update.usageVisibility = ps.usageVisibility;
		if (ps.allowedUserIds !== undefined) update.allowedUserIds = ps.allowedUserIds;
		if (ps.motifUserId !== undefined) update.motifUserId = ps.motifUserId;
		if (ps.motifUserMode !== undefined) update.motifUserMode = ps.motifUserMode;
		await Emojis.update(emoji.id, update);
	}

	const updated = await Emojis.findBy({ id: In(ps.ids) });
	publishBroadcastStream("emojiUpdated", {
		emojis: await Emojis.packMany(updated),
	});

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();
});
