import { IsNull, MoreThan, Not } from "typeorm";
import config from "@/config/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Ads, Emojis, Users } from "@/models/index.js";
import define from "../define.js";

export const meta = {
	tags: ['meta'],

	requireCredential: false,
	requireCredentialPrivateMode: true,
	allowGet: true,
	cacheSec: 3600,

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			emojis: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					optional: false,
					nullable: false,
					ref: 'EmojiSimple',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	
	let emojis = await Emojis.find({
		where: {
			host: IsNull(),
			oldEmoji: false,
		},
		order: {
			category: "ASC",
			name: "ASC",
		},
		cache: {
			id: "meta_emojis",
			milliseconds: 3600000, // 1 hour
		},
	});

	// データ削減の為、不要情報を削除
	emojis?.forEach((x) => {
		delete x.updatedAt
		delete x.license
	});
	
	const emojiNames = emojis.map((x) => x.name);
	
	let remoteEmojis = undefined;
	
	let remoteEmojiMode = "none";
	
	if(ps.remoteEmojis === "mini" || ps.plusEmojis){
			
		remoteEmojis = (await Emojis.find({
			where: [
				{
					host: "misskey.io",
				},
				{
					host: "fedibird.com",
				},
				{
					host: "misskey.backspace.fm",
				},
				{
					host: "misskey.takehi.to"
				},
			],
			order: {
				name: "ASC",
			},
			cache: {
				id: "meta_plus_emojis",
				milliseconds: 3600000, // 1 hour
			},
		})).filter((x) => !emojiNames.includes(x.name) && !x.oldEmoji && (x.name?.length ?? 0) < 75 && (x.publicUrl?.length ?? 0) < 140).slice(0,10000);
		
		// データ削減の為、不要情報を削除
		remoteEmojis?.forEach((x) => {
			delete x.createdAt
			delete x.updatedAt
			delete x.category
			delete x.aliases
			delete x.license
		});

		remoteEmojiMode = "plus";

	} else if (ps.remoteEmojis === "all" || ps.allEmojis) {
		remoteEmojis = ps.allEmojis 
		? (await Emojis.find({
			where: {
				host: Not(IsNull()),
				oldEmoji: false,
			},
			order: {
				name: "ASC",
			},
			cache: {
				id: "meta_all_emojis",
				milliseconds: 3600000, // 1 hour
			},
		})).filter((x) => !emojiNames.includes(x.name) && !["voskey.icalo.net"].includes(x.host) && (x.name?.length ?? 0) < 75 && (x.host?.length ?? 0) < 50 && (x.publicUrl?.length ?? 0) < 140) : undefined;

		// データ削減の為、不要情報を削除
		remoteEmojis?.forEach((x) => {
			delete x.createdAt
			delete x.updatedAt
			delete x.category
			delete x.aliases
			delete x.license
		});
		
		remoteEmojiMode = "all";
	
	}

	return {
		emojis: await Emojis.packMany(emojis),
		...(remoteEmojiMode !== "none" && me
			? {
					emojiFetchDate: new Date(),
					remoteEmojiMode: remoteEmojiMode,
					remoteEmojiCount: remoteEmojis.length,
					allEmojis: await Emojis.packMany(remoteEmojis),
			  }
			: {}),
	};
});