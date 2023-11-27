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

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			emojis: {
				type: "array",
				optional: false,
				nullable: false,
				items: {
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
						aliases: {
							type: "array",
							optional: false,
							nullable: false,
							items: {
								type: "string",
								optional: false,
								nullable: false,
							},
						},
						category: {
							type: "string",
							optional: false,
							nullable: true,
						},
						host: {
							type: "string",
							optional: false,
							nullable: true,
							description: "The local host is represented with `null`.",
						},
						url: {
							type: "string",
							optional: false,
							nullable: false,
							format: "url",
						},
					},
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
		order: ps.createdAtDesc ? {
			createdAt: "DESC",
		} : {
			category: "ASC",
			name: "ASC",
		},
		cache: {
			id: ps.createdAtDesc ? "meta_emojis2" : "meta_emojis",
			milliseconds: 3600000, // 1 hour
		},
	});

	// データ削減の為、不要情報を削除
	emojis?.forEach((x) => {
		delete x.license
	});
	if (false && !ps.includeUrl) {
		emojis?.forEach((x) => {
			delete x.publicUrl
			delete x.originalUrl
		});
	}

	const emojiNames = emojis.map((x) => x.name);

	let remoteEmojis = undefined;

	let remoteEmojiMode = undefined;

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
					host: "minazukey.uk",
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
		})).filter((x) => !emojiNames.includes(x.name) && !x.oldEmoji && (x.name?.length ?? 0) < 100 && !x.license?.includes("コピー可否 : deny")).slice(0,15000);

		// データ削減の為、不要情報を削除
		remoteEmojis?.forEach((x) => {
			delete x.createdAt
			delete x.updatedAt
			delete x.category
			delete x.aliases
			delete x.license
		});
		if (!ps.includeUrl) {
			remoteEmojis?.forEach((x) => {
				delete x.publicUrl
				delete x.originalUrl
			});
		}

		remoteEmojiMode = "plus";

	} else if (ps.remoteEmojis === "all" || ps.allEmojis) {
		remoteEmojis = (await Emojis.find({
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
		})).filter((x) => !emojiNames.includes(x.name) && !["voskey.icalo.net","9ineverse.com"].includes(x.host) && (x.name?.length ?? 0) < 100 && (x.host?.length ?? 0) < 50 && !x.license?.includes("コピー可否 : deny"));

		// データ削減の為、不要情報を削除
		remoteEmojis?.forEach((x) => {
			delete x.createdAt
			delete x.updatedAt
			delete x.category
			delete x.aliases
			delete x.license
		});
		if (!ps.includeUrl) {
			remoteEmojis?.forEach((x) => {
				delete x.publicUrl
				delete x.originalUrl
			});
		}

		remoteEmojiMode = "all";

	}

	return {
		emojis: await Emojis.packMany(emojis.filter((x) => !x.category?.startsWith("!"))),
		...(remoteEmojiMode && remoteEmojis && me
			? {
					emojiFetchDate: new Date(),
					remoteEmojiMode: remoteEmojiMode,
					remoteEmojiCount: remoteEmojis?.length ?? 0,
					allEmojis: await Emojis.packMany(remoteEmojis),
			  }
			: {}),
	};
});
