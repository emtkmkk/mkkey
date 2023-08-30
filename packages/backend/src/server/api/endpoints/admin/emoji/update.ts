import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { ApiError } from "../../../error.js";
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
			id: "684dec9d-a8c2-4364-9aa8-456c49cb1dc8",
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
		license: {
			type: "string",
			nullable: true,
		},
	},
	required: ["id", "name", "aliases"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const emoji = await Emojis.findOneBy({ id: ps.id });

	if (emoji == null) throw new ApiError(meta.errors.noSuchEmoji);
	
	const license = 
		ps.license
		.replace(/^!m$/,"文字だけ")
		.replace("!ca","コピー可否 : allow")
		.replace("!cd","コピー可否 : deny")
		.replace("!cc","コピー可否 : conditional")
		.replace("!l : ","ライセンス : ")
		.replace("!u : ","使用情報 : ")
		.replace("!a : ","作者 : ")
		.replace("!d : ","説明 : ")
		.replace("!b : ","元画像 : ")
		.replace("!i : ","元画像 : ")
		.replace("!c0","CC0 1.0 Universal")
		.replace("!cb","CC BY 4.0");

	await Emojis.update(emoji.id, {
		updatedAt: new Date(),
		name: ps.name,
		category: ps.category,
		aliases: ps.aliases,
		license,
	});
	
	const pack = await Emojis.pack(emoji.id)

	if (pack.category?.startsWith("!")){
		publishBroadcastStream("emojiDeleted", {
			emoji: pack,
			emojis: [pack],
		});
	} else {
		publishBroadcastStream("emojiUpdated", {
			emoji: pack,
			emojis: [pack],
		});
	}

	await db.queryResultCache!.remove(["meta_emojis"]);
});
