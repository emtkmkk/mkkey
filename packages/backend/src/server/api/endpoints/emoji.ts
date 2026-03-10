import { IsNull } from "typeorm";
import { Emojis } from "@/models/index.js";
import define from "../define.js";
import { ApiError } from "../error.js";
import { toPuny } from "@/misc/convert-host.js";
import { getJson } from "@/misc/fetch.js";
import { genId } from "@/misc/gen-id.js";
import { toStoredCopyPermission } from "@/misc/copy-permission.js";

export const meta = {
	tags: ["meta"],

	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,

	errors: {
		noSuchEmoji: {
			message: "No such emoji.",
			code: "NO_SUCH_EMOJI",
			id: "6023366f-c5a9-4f6d-a7f8-bff2cc53f963",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Emoji",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		name: {
			type: "string",
		},
		host: {
			type: "string",
		},
	},
	required: ["name"],
} as const;

type RemoteEmojiPayload = {
	name?: string;
	aliases?: unknown;
	category?: string | null;
	url?: string;
	uri?: string | null;
	copyPermission?: string | null;
	licenseName?: string | null;
	usageInfo?: string | null;
	creator?: string | null;
	description?: string | null;
	isBasedOnUrl?: string | null;
	license?: string | null;
	sensitive?: boolean;
};

async function fetchRemoteEmoji(name: string, host: string) {
	const normalizedHost = toPuny(host);
	const apiurl = `https://${normalizedHost}/api/emoji?name=${encodeURIComponent(name)}`;
	const remote = (await getJson(
		apiurl,
		"application/json, */*",
		5000,
	)) as RemoteEmojiPayload;

	if (!remote?.url) {
		return null;
	}

	const now = new Date();
	const normalizedName = remote.name ?? name;
	const exists = await Emojis.findOneBy({
		name: normalizedName,
		host: normalizedHost,
	});

	const updateData = {
		updatedAt: now,
		name: normalizedName,
		host: normalizedHost,
		category: remote.category ?? null,
		originalUrl: remote.url,
		publicUrl: remote.url,
		uri: remote.uri ?? null,
		aliases: Array.isArray(remote.aliases)
			? remote.aliases.filter((x): x is string => typeof x === "string")
			: [],
		copyPermission: toStoredCopyPermission(remote.copyPermission ?? null),
		licenseName: remote.licenseName ?? null,
		usageInfo: remote.usageInfo ?? null,
		creator: remote.creator ?? null,
		description: remote.description ?? null,
		isBasedOnUrl: remote.isBasedOnUrl ?? null,
		license: remote.license ?? null,
		sensitive: remote.sensitive ?? false,
	};

	if (exists) {
		await Emojis.update({ id: exists.id }, updateData);
		return await Emojis.findOneBy({ id: exists.id });
	}

	const inserted = await Emojis.insert({
		id: genId(),
		createdAt: now,
		usageVisibility: "public",
		...updateData,
	});

	return await Emojis.findOneBy(inserted.identifiers[0]);
}

export default define(meta, paramDef, async (ps, me) => {
	const isLocalHost = ps.host == null || ps.host === "" || ps.host === ".";
	const whereHost = isLocalHost ? IsNull() : toPuny(ps.host);

	let emoji = await Emojis.findOne({
		where: {
			name: ps.name,
			host: whereHost,
		},
	});

	// 未知リモート絵文字の照会は認証済みユーザー時のみ行う
	if (!emoji && !isLocalHost && me) {
		emoji = await fetchRemoteEmoji(ps.name, ps.host);
	}

	if (!emoji) {
		throw new ApiError(meta.errors.noSuchEmoji);
	}

	return Emojis.pack(emoji);
});
