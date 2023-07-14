import { IsNull } from "typeorm";
import define from "../../../define.js";
import { Emojis, DriveFiles } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { ApiError } from "../../../error.js";
import rndstr from "rndstr";
import { publishBroadcastStream } from "@/services/stream.js";
import { db } from "@/db/postgre.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	errors: {
		noSuchFile: {
			message: "No such file.",
			code: "MO_SUCH_FILE",
			id: "fc46b5a4-6b92-4c33-ac66-b806659bb5cf",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		fileId: { type: "string", format: "misskey:id" },
	},
	required: ["fileId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const file = await DriveFiles.findOneBy({ id: ps.fileId });

	if (file == null) throw new ApiError(meta.errors.noSuchFile);

	let name = file.name.split(".")?.[0]?.replaceAll(/[^A-Za-z0-9_]+/g,"") || `_${rndstr("a-z0-9", 8)}_`;
	/*file.name.split(".")[0].match(/^[A-Za-z0-9_]+$/)
		? file.name.split(".")[0]
		: `_${rndstr("a-z0-9", 8)}_`;*/
	
	const emojiSearchName = await Emojis.findOneBy({ name: name , host: IsNull() });
	
	// 名前重複の場合
	if (emojiSearchName) {
		name = name + `_${rndstr("a-z0-9", 8)}`;
	}

	const emoji = await Emojis.insert({
		id: genId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		name: name,
		category: null,
		host: null,
		aliases: [],
		originalUrl: file.url,
		publicUrl: file.webpublicUrl ?? file.url,
		type: file.webpublicType ?? file.type,
		license: null,
	}).then((x) => Emojis.findOneByOrFail(x.identifiers[0]));

	await db.queryResultCache!.remove(["meta_emojis"]);

	publishBroadcastStream("emojiAdded", {
		emoji: await Emojis.pack(emoji.id),
	});

	insertModerationLog(me, "addEmoji", {
		emojiId: emoji.id,
	});

	return {
		id: emoji.id,
	};
});
