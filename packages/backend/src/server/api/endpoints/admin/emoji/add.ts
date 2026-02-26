/**
 * 絵文字追加 API
 *
 * @remarks
 * ライセンスは個別パラメータ（copyPermission, licenseName 等）で指定。isTextOnly 時は 3 項目を固定値で保存。
 * 従来形式の license（「コピー可否 : 」「ライセンス : 」等のキー・値形式）が渡された場合はパースして個別カラムに展開する。
 * 新規追加時は usageVisibility 未指定なら private。private のときは emojiAdded を送信しない。
 */
import { IsNull } from "typeorm";
import define from "../../../define.js";
import { Emojis, DriveFiles } from "@/models/index.js";
import { getEffectiveUsageVisibility } from "@/models/repositories/emoji.js";
import { toStoredCopyPermission } from "@/misc/copy-permission.js";
import { genId } from "@/misc/gen-id.js";
import { parseLicenseString } from "@/misc/parse-license.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { ApiError } from "../../../error.js";
import rndstr from "rndstr";
import { publishBroadcastStream } from "@/services/stream.js";
import { db } from "@/db/postgre.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";

const COPY_PERMISSION_VALUES = ["allow", "deny", "conditional", "none"] as const;

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	errors: {
		noSuchFile: {
			message: "そのファイルは存在しません。",
			code: "MO_SUCH_FILE",
			id: "fc46b5a4-6b92-4c33-ac66-b806659bb5cf",
		},
		duplicateEmojiName: {
			message: "絵文字名が重複しています。",
			code: "DUPLICATE_EMOJI_NAME",
			id: "a7f2bc3d-b1c2-4678-b023-9f8c5d4e2abc",
		},
		invalidCopyPermission: {
			message: "copyPermission は allow / deny / conditional / none のいずれかを指定してください。",
			code: "INVALID_COPY_PERMISSION",
			id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		fileId: { type: "string", format: "misskey:id" },
		name: { type: "string", nullable: true },
		category: {
			type: "string",
			nullable: true,
		},
		aliases: {
			type: "array",
			items: {
				type: "string",
			},
			nullable: true,
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
			description: "使用可能状態。未指定時は private",
		},
		allowedUserIds: {
			type: "array",
			items: { type: "string", format: "misskey:id" },
			nullable: true,
			description: "usageVisibility が user のときの許可ユーザ ID 配列",
		},
		motifUserId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			description: "モチーフユーザー（紐づけユーザー）ID",
		},
		motifUserMode: {
			type: "string",
			nullable: true,
			enum: ["any", "follow", "owner"],
			description: "モチーフの利用範囲。未指定時は any",
		},
	},
	required: ["fileId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const file = await DriveFiles.findOneBy({ id: ps.fileId });

	if (file == null) throw new ApiError(meta.errors.noSuchFile);

	if (
		ps.copyPermission != null &&
		!COPY_PERMISSION_VALUES.includes(ps.copyPermission as typeof COPY_PERMISSION_VALUES[number])
	) {
		throw new ApiError(meta.errors.invalidCopyPermission);
	}

	let name =
		ps.name ||
		file.name
			.split(".")?.[0]
			?.replaceAll(/[^A-Za-z0-9_]+/g, "")
			.toLowerCase() ||
		`_${rndstr("a-z0-9", 8)}_`;

	const emojiSearchName = await Emojis.findOneBy({
		name: name,
		host: IsNull(),
	});

	// 名前重複の場合
	if (emojiSearchName) {
		if (ps.name) {
			throw new ApiError(meta.errors.duplicateEmojiName);
		}
		name = `${name}_${rndstr("a-z0-9", 8)}`;
	}

	const isTextOnly = ps.isTextOnly ?? false;
	const insertRow = {
		id: genId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		name: name,
		category: ps.category ?? null,
		host: null,
		aliases: ps.aliases ?? [],
		originalUrl: file.url,
		publicUrl: file.webpublicUrl ?? file.url,
		type: file.webpublicType ?? file.type,
		usageInfo: ps.usageInfo ?? null,
		description: ps.description ?? null,
		isBasedOnUrl: ps.isBasedOnUrl ?? null,
		license: ps.license ?? null,
		isTextOnly,
		sensitive: ps.sensitive ?? false,
		usageVisibility: ps.usageVisibility ?? "private",
		allowedUserIds: ps.allowedUserIds ?? [],
		motifUserId: ps.motifUserId ?? null,
		motifUserMode: ps.motifUserMode ?? "any",
	} as Record<string, unknown>;

	const noIndividualLicenseFields =
		ps.copyPermission == null &&
		ps.licenseName == null &&
		ps.usageInfo == null &&
		ps.creator == null &&
		ps.description == null &&
		ps.isBasedOnUrl == null;
	const hasLegacyLicense =
		ps.license != null && typeof ps.license === "string" && ps.license.trim() !== "";

	if (noIndividualLicenseFields && hasLegacyLicense) {
		const parsed = parseLicenseString(ps.license);
		if (parsed !== null) {
			insertRow.license = parsed.remainder;
			insertRow.isTextOnly = parsed.isTextOnly;
			if (parsed.isTextOnly) {
				insertRow.copyPermission = toStoredCopyPermission("allow");
				insertRow.licenseName = "CC0 1.0 Universal";
				insertRow.creator = null;
			} else {
				insertRow.copyPermission = parsed.copyPermission;
				insertRow.licenseName = parsed.licenseName;
				insertRow.usageInfo = parsed.usageInfo;
				insertRow.creator = parsed.creator;
				insertRow.description = parsed.description;
				insertRow.isBasedOnUrl = parsed.isBasedOnUrl;
			}
		} else {
			insertRow.copyPermission = toStoredCopyPermission(null);
			insertRow.licenseName = null;
			insertRow.creator = null;
		}
	} else {
		if (isTextOnly) {
			insertRow.copyPermission = toStoredCopyPermission("allow");
			insertRow.licenseName = "CC0 1.0 Universal";
			insertRow.creator = null;
		} else {
			insertRow.copyPermission = toStoredCopyPermission(ps.copyPermission ?? null);
			insertRow.licenseName = ps.licenseName ?? null;
			insertRow.creator = ps.creator ?? null;
		}
	}

	const emoji = await Emojis.insert(insertRow as Parameters<typeof Emojis.insert>[0]).then(
		(x) => Emojis.findOneByOrFail(x.identifiers[0]),
	);

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();

	if (getEffectiveUsageVisibility(emoji) !== "private") {
		publishBroadcastStream("emojiAdded", {
			emoji: await Emojis.pack(emoji.id),
		});
	}

	insertModerationLog(me, "addEmoji", {
		emojiId: emoji.id,
	});

	return {
		id: emoji.id,
	};
});
