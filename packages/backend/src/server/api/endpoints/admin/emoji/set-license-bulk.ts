import define from "../../../define.js";
import { Emojis } from "@/models/index.js";
import { In } from "typeorm";
import { ApiError } from "../../../error.js";
import { db } from "@/db/postgre.js";
import { publishBroadcastStream } from "@/services/stream.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
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
		license: {
			type: "string",
			nullable: true,
			description: "Use `null` to reset the license.",
		},
	},
	required: ["ids"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const emojis = await Emojis.findBy({
		id: In(ps.ids),
	});
	
	let license = ps.license;
	if (ps.license?.includes("!")){
		license = license
		.replace(/^!m$/,"文字だけ")
		.replace(/!ca(,|$)/,"コピー可否 : allow")
		.replace(/!cd(,|$)/,"コピー可否 : deny")
		.replace(/!cc(,|$)/,"コピー可否 : conditional")
		.replace(/!l : ([^,:]+)(,|$)/,"ライセンス : $1$2")
		.replace(/!u : ([^,:]+)(,|$)/,"使用情報 : $1$2")
		.replace(/!a : ([^,:]+)(,|$)/,"作者 : $1$2")
		.replace(/!d :  ([^,:]+)(,|$)/,"説明 : $1$2")
		.replace(/!b :  ([^,:]+)(,|$)/,"コピー元 : $1$2")
		.replace(/!i :  ([^,:]+)(,|$)/,"コピー元 : $1$2")
		.replace("!c0","CC0 1.0 Universal")
		.replace("!cb","CC BY 4.0");
	}

	await Emojis.update(
		{
			id: In(ps.ids),
		},
		{
			updatedAt: new Date(),
			license,
		},
	);
	
	publishBroadcastStream("emojiUpdated", {
		emojis: await Emojis.packMany(emojis),
	});

	await db.queryResultCache!.remove(["meta_emojis"]);
});
