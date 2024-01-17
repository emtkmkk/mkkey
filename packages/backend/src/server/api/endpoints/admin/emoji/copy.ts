import { IsNull } from "typeorm";
import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { ApiError } from "../../../error.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import { publishBroadcastStream } from "@/services/stream.js";
import { db } from "@/db/postgre.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	errors: {
		noSuchEmoji: {
			message: "No such emoji.",
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
		emoji = await Emojis.findOneBy({ name: ps.emojiName , host: ps.emojiHost });
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
	
	const emojiSearchName = await Emojis.findOneBy({ name: emoji.name , host: IsNull() });
	
	const emojiSearchNamePlusHost = await Emojis.findOneBy({ name: `${emoji.name}_${emoji.host.replaceAll(/[^\w]/ig, "_")}` , host: IsNull() });

	if (emojiSearchNamePlusHost != null){
		throw new ApiError(meta.errors.alreadyRegistered);
	}
	
	const copied = await Emojis.insert({
		id: genId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		name: emojiSearchName ? `${emoji.name}_${emoji.host.replaceAll(/[^\w]/ig, "_")}` : emoji.name,
		host: null,
		aliases: emoji.aliases ?? [],
		originalUrl: driveFile.url,
		publicUrl: driveFile.webpublicUrl ?? driveFile.url,
		type: driveFile.webpublicType ?? driveFile.type,
		license: `Copy to ${emoji.host ?? "unknown"}${emoji.license ? `, ${emoji.license.replace(/コピー元 : ([^,]+)(,|$)/, "")}` : ""}${emoji.uri ? `, コピー元 : ${emoji.uri}` : ""}`,
	}).then((x) => Emojis.findOneByOrFail(x.identifiers[0]));

	await db.queryResultCache!.remove(["meta_emojis"]);

	publishBroadcastStream("emojiAdded", {
		emoji: await Emojis.pack(copied.id),
	});

	return {
		id: copied.id,
	};
});
