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
	
	const license = 
		ps.license
		.replace(/^!m$/,"文字だけ")
		.replace("!c : ","コピー可否 : ")
		.replace("!l : ","ライセンス : ")
		.replace("!u : ","使用情報 : ")
		.replace("!a : ","作者 : ")
		.replace("!d : ","説明 : ")
		.replace("!b : ","元画像 : ")
		.replace("!i : ","元画像 : ")
		.replace("!0","CC0 1.0 Universal")
		.replace("!cb","CC BY 4.0");

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
