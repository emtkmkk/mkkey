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
		duplicateEmojiName: {
			message: "The specified emoji name already exists.",
			code: "DUPLICATE_EMOJI_NAME",
			id: "a7f2bc3d-b1c2-4678-b023-9f8c5d4e2abc",
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
		license: {
			type: "string",
			nullable: true,
		},
	},
	required: ["fileId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const file = await DriveFiles.findOneBy({ id: ps.fileId });

	if (file == null) throw new ApiError(meta.errors.noSuchFile);

	let name = ps.name || file.name.split(".")?.[0]?.replaceAll(/[^A-Za-z0-9_]+/g,"").toLowerCase() || `_${rndstr("a-z0-9", 8)}_`;
	/*file.name.split(".")[0].match(/^[A-Za-z0-9_]+$/)
		? file.name.split(".")[0]
		: `_${rndstr("a-z0-9", 8)}_`;*/
	
	const emojiSearchName = await Emojis.findOneBy({ name: name , host: IsNull() });
	
	// 名前重複の場合
	if (emojiSearchName) {
		if (ps.name) {
			throw new ApiError(meta.errors.duplicateEmojiName);
		}
		name = `${name}_${rndstr("a-z0-9", 8)}`;
	}

	let license = ps.license;
	if (ps.license?.includes("!")){
		license = license
		.replace(/^!m$/,"文字だけ")
		.replace(/!ca(,|$)/,"コピー可否 : allow")
		.replace(/!cd(,|$)/,"コピー可否 : deny")
		.replace(/!cc(,|$)/,"コピー可否 : conditional")
		.replace(/!l : ([^,]+)(,|$)/,"ライセンス : $1$2")
		.replace(/!u : ([^,]+)(,|$)/,"使用情報 : $1$2")
		.replace(/!a : ([^,]+)(,|$)/,"作者 : $1$2")
		.replace(/!d : ([^,]+)(,|$)/,"説明 : $1$2")
		.replace(/!b : ([^,]+)(,|$)/,"コピー元 : $1$2")
		.replace(/!i : ([^,]+)(,|$)/,"コピー元 : $1$2")
		.replace("!c0","CC0 1.0 Universal")
		.replace("!cb","CC BY 4.0");
	}

	const emoji = await Emojis.insert({
		id: genId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		name: name,
		category: ps.category || null,
		host: null,
		aliases: ps.aliases || [],
		originalUrl: file.url,
		publicUrl: file.webpublicUrl ?? file.url,
		type: file.webpublicType ?? file.type,
		license: license || null,
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
