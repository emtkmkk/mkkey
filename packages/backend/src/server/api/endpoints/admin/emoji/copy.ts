/**
 * 絵文字コピー API
 *
 * @remarks
 * コピー元は isBasedOnUrl に URI。補足情報（license）には「Copy to 〇〇」を格納。
 * モチーフ情報は引き継がず、usageVisibility は常に private で新規作成する（emojiAdded は送信しない）。
 */
import { IsNull } from "typeorm";
import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { ApiError } from "../../../error.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import { db } from "@/db/postgre.js";
import { bumpReactionNormalizeCacheVersion } from "@/misc/reaction-normalize-cache.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	errors: {
		noSuchEmoji: {
			message: "その絵文字は存在しません。",
			code: "NO_SUCH_EMOJI",
			id: "e2785b66-dca3-4087-9cac-b93c541cc425",
		},
		alreadyRegistered: {
			message: "Already Registered.",
			code: "ALREADY_REGISTERED",
			id: "e2785b66-dca3-4087-9cac-ad17432b63f1",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			id: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		emojiId: { type: "string", format: "misskey:id" },
		emojiName: { type: "string" },
		emojiHost: { type: "string" },
	},
	anyOf: [{ required: ["emojiId"] }, { required: ["emojiName", "emojiHost"] }],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	let emoji;
	if (ps.emojiName && ps.emojiHost) {
		emoji = await Emojis.findOneBy({ name: ps.emojiName, host: ps.emojiHost });
	} else {
		emoji = await Emojis.findOneBy({ id: ps.emojiId });
	}

	if (emoji == null) {
		throw new ApiError(meta.errors.noSuchEmoji);
	}

	let driveFile: DriveFile;

	try {
		// Create file
		driveFile = await uploadFromUrl({
			url: emoji.originalUrl,
			user: null,
			force: true,
		});
	} catch (e) {
		throw new ApiError();
	}

	const emojiSearchName = await Emojis.findOneBy({
		name: emoji.name,
		host: IsNull(),
	});

	const emojiSearchNamePlusHost = await Emojis.findOneBy({
		name: `${emoji.name}_${emoji.host.replaceAll(/[^\w]/gi, "_")}`,
		host: IsNull(),
	});

	if (emojiSearchNamePlusHost != null) {
		throw new ApiError(meta.errors.alreadyRegistered);
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
		name: emojiSearchName
			? `${emoji.name}_${emoji.host.replaceAll(/[^\w]/gi, "_")}`
			: emoji.name,
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
		usageVisibility: "private",
		allowedUserIds: [],
		motifUserId: null,
		motifUserMode: "any",
	}).then((x) => Emojis.findOneByOrFail(x.identifiers[0]));

	await db.queryResultCache!.remove(["meta_emojis"]);
	await bumpReactionNormalizeCacheVersion();

	// コピーは常に private のため emojiAdded は送信しない

	return {
		id: copied.id,
	};
});
