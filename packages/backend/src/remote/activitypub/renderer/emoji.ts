/**
 * ActivityPub 用 Emoji オブジェクトのレンダラ
 *
 * @remarks
 * isTextOnly のときは copyPermission / license / creator を固定値で返す。DB の copyPermission（a/d/c/n）は完全形に変換して返す。
 * ActivityPub 仕様に合わせて出力キーは "creator"。
 * 連合にはモチーフ情報を配信しない（motifUserId / motifUserMode は出力に含めない）。
 * Fedibird 互換の項目（alternateName / ruby / relatedLinks / copyrightNotice / creditText）も送る。
 * 上流 Misskey 向けに `_misskey_license.freeText` を Fedibird の format_summary と同じ書き方で付ける。
 * ライセンスは今までどおり名前で送る（URL は必須ではない）。カテゴリは今は送らない。
 */
import config from "@/config/index.js";
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import { buildMisskeyLicenseFreeText } from "@/misc/emoji-fedibird.js";
import type { Emoji } from "@/models/entities/emoji.js";

export default (emoji: Emoji) => {
	const copyPermission = emoji.isTextOnly
		? "allow"
		: fromStoredCopyPermission(emoji.copyPermission);
	const license = emoji.isTextOnly
		? "CC0 1.0 Universal"
		: (emoji.licenseName ?? null);
	const creator = emoji.isTextOnly ? config.host : (emoji.creator ?? undefined);
	// 古い行では relatedLinks が無いこともあるので空配列で受ける
	const relatedLinks = emoji.relatedLinks ?? [];
	const freeText = buildMisskeyLicenseFreeText({
		alternateName: emoji.alternateName ?? null,
		ruby: emoji.ruby ?? null,
		creator: creator ?? null,
		copyrightNotice: emoji.copyrightNotice ?? null,
		creditText: emoji.creditText ?? null,
		licenseName: license,
		usageInfo: emoji.usageInfo ?? null,
		relatedLinks,
		copyPermission,
		description: emoji.description ?? null,
	});

	return {
		id: emoji.uri || `${config.url}/emojis/${emoji.name}`,
		type: "Emoji",
		name: `:${emoji.name}:`,
		host: `${emoji.host ?? config.host}`,
		// リモート絵文字でも保存済みの更新日時を使う（毎回 now を送ると受信側で毎回「更新あり」と判定される）
		updated: (emoji.updatedAt ?? emoji.createdAt ?? new Date()).toISOString(),
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
		// as:sensitive は @context のマッピング先であり、値は boolean を送る
		sensitive: emoji.sensitive ? true : undefined,
		// Fedibird 互換の項目。空のものは送らない
		alternateName: emoji.alternateName || undefined,
		ruby: emoji.ruby || undefined,
		relatedLinks: relatedLinks.length > 0 ? relatedLinks : undefined,
		copyrightNotice: emoji.copyrightNotice || undefined,
		creditText: emoji.creditText || undefined,
		// 上流 Misskey はライセンスをこの 1 行だけで受け取るので、Fedibird と同じ書き方でまとめて送る
		_misskey_license: freeText != null ? { freeText } : undefined,
		// TODO: category / orgCategory の送信は後で行う（今は止めておく方針）
	};
};
