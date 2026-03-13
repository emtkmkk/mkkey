/**
 * ActivityPub 用 Emoji オブジェクトのレンダラ
 *
 * @remarks
 * isTextOnly のときは copyPermission / license / creator を固定値で返す。DB の copyPermission（a/d/c/n）は完全形に変換して返す。
 * ActivityPub 仕様に合わせて出力キーは "creator"。
 * 連合にはモチーフ情報を配信しない（motifUserId / motifUserMode は出力に含めない）。
 */
import config from "@/config/index.js";
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import type { Emoji } from "@/models/entities/emoji.js";

export default (emoji: Emoji) => {
	const copyPermission = emoji.isTextOnly
		? "allow"
		: fromStoredCopyPermission(emoji.copyPermission);
	const license = emoji.isTextOnly
		? "CC0 1.0 Universal"
		: (emoji.licenseName ?? null);
	const creator = emoji.isTextOnly ? config.host : (emoji.creator ?? undefined);

	return {
		id: emoji.uri || `${config.url}/emojis/${emoji.name}`,
		type: "Emoji",
		name: `:${emoji.name}:`,
		host: `${emoji.host ?? config.host}`,
		updated:
			!emoji.host && emoji.updatedAt != null
				? emoji.updatedAt.toISOString()
				: new Date().toISOString(),
		icon: {
			type: "Image",
			mediaType: emoji.type || "image/png",
			url: emoji.publicUrl || emoji.originalUrl, // 後方互換のため || emoji.originalUrl を使用
		},
		keywords: emoji.aliases,
		copyPermission,
		license,
		usageInfo: emoji.usageInfo ?? undefined,
		creator,
		description: emoji.description ?? undefined,
		isBasedOnUrl: emoji.isBasedOnUrl ?? undefined,
		sensitive: emoji.sensitive ? "as:sensitive" : undefined,
	};
};
