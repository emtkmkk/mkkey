import config from "@/config/index.js";
import type { Emoji } from "@/models/entities/emoji.js";

export default (emoji: Emoji) => ({
	id: emoji.uri || `${config.url}/emojis/${emoji.name}`,
	type: "Emoji",
	name: `:${emoji.name}:`,
	host: `${emoji.host ?? "mkkey.net"}`,
	updated:
		!emoji.host && emoji.updatedAt != null
			? emoji.updatedAt.toISOString()
			: new Date().toISOString,
	icon: {
		type: "Image",
		mediaType: emoji.type || "image/png",
		url: emoji.publicUrl || emoji.originalUrl, // || emoji.originalUrl してるのは後方互換性のため
	},
	keyword: emoji.aliases,
	...(!emoji.host && emoji.license === "文字だけ" ? {
		copyPermission: "allow",
		license: "CC0 1.0 Universal",
		author: "mkkey.net"
	} : {
		copyPermission: emoji.license?.includes("コピー可否 : ") ? /コピー可否 : (\w+)(,|$)/.exec(emoji.license)?.[1] ?? "none" : "none",
		license: emoji.license?.includes("ライセンス : ") ? /ライセンス : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? null : null,
		usageInfo: emoji.license?.includes("使用情報 : ") ? /使用情報 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
		author: emoji.license?.includes("作者 : ") ? /作者 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
		description: emoji.license?.includes("説明 : ") ? /説明 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
		isBasedOnUrl: emoji.license?.includes("コピー元 : ") ? /コピー元 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
	})
});
