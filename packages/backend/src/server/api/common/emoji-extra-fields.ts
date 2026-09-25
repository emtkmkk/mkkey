/**
 * @packageDocumentation
 *
 * 絵文字の Fedibird 互換項目（表示名・読み・関連リンク・著作権表示・クレジット・コピー元のカテゴリ）を、
 * API のパラメータとして受け取るための共通定義。
 *
 * @remarks
 * `admin/emoji/add` と `admin/emoji/update` で同じ受け取り方をするためにまとめている。
 * 追加申請・変更申請の API からも使う予定。
 * - パラメータを省略した項目は「変更しない」（update）／「空」（add）
 * - `null` や空文字は「空にする」
 * - sourceLicenseText（リモートの参考情報）は API からは変更させない
 *
 * @internal
 */
import { parseRelatedLinks } from "@/misc/emoji-fedibird.js";

/** 表示名・読み・カテゴリの最大文字数（DB 列の長さに合わせる） */
const MAX_SHORT = 512;
const MAX_CATEGORY = 128;

/**
 * paramDef.properties に混ぜ込む定義。
 *
 * @example
 * ```ts
 * properties: { ...emojiExtraFieldsParamDef, name: { type: "string" } }
 * ```
 * @internal
 */
export const emojiExtraFieldsParamDef = {
	alternateName: { type: "string", nullable: true, maxLength: MAX_SHORT },
	ruby: { type: "string", nullable: true, maxLength: MAX_SHORT },
	relatedLinks: {
		type: "array",
		nullable: true,
		items: { type: "string" },
	},
	copyrightNotice: { type: "string", nullable: true },
	creditText: { type: "string", nullable: true },
	orgCategory: { type: "string", nullable: true, maxLength: MAX_CATEGORY },
} as const;

/** {@link emojiExtraFieldsParamDef} で受け取ったパラメータ */
export interface EmojiExtraFieldsParams {
	alternateName?: string | null;
	ruby?: string | null;
	relatedLinks?: string[] | null;
	copyrightNotice?: string | null;
	creditText?: string | null;
	orgCategory?: string | null;
}

/** 保存する列と値 */
export interface EmojiExtraFieldsColumns {
	alternateName?: string | null;
	ruby?: string | null;
	relatedLinks?: string[];
	copyrightNotice?: string | null;
	creditText?: string | null;
	orgCategory?: string | null;
}

/**
 * 空白だけの文字列を null にそろえる。
 *
 * @param value - パラメータの値
 * @returns 前後の空白を除いた文字列、または null
 */
function toNullableText(value: string | null): string | null {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

/**
 * パラメータから、保存する列だけを取り出す。
 *
 * @remarks
 * 省略された（undefined の）項目は結果に含めない。update ではそのまま「変更しない」になる。
 *
 * @param ps - API のパラメータ
 * @returns 保存する列と値
 * @internal
 */
export function pickEmojiExtraFields(ps: EmojiExtraFieldsParams): EmojiExtraFieldsColumns {
	const out: EmojiExtraFieldsColumns = {};
	if (ps.alternateName !== undefined) out.alternateName = toNullableText(ps.alternateName);
	if (ps.ruby !== undefined) out.ruby = toNullableText(ps.ruby);
	if (ps.relatedLinks !== undefined) out.relatedLinks = parseRelatedLinks(ps.relatedLinks ?? []);
	if (ps.copyrightNotice !== undefined) out.copyrightNotice = toNullableText(ps.copyrightNotice);
	if (ps.creditText !== undefined) out.creditText = toNullableText(ps.creditText);
	if (ps.orgCategory !== undefined) out.orgCategory = toNullableText(ps.orgCategory);
	return out;
}
