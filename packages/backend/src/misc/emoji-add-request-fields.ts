/**
 * @packageDocumentation
 *
 * 絵文字の追加申請（emoji_add_request）の入力・値の組み立ての純粋な処理。
 *
 * @remarks
 * DB・設定・ネットワークに触れない関数だけを置く（単体テストで直接呼べるようにするため）。
 * 通知と API で返す形は {@link "@/services/emoji-add-request"} にある。
 * - 入力の定義（{@link emojiAddRequestFieldsParamDef}）と検査・正規化（{@link normalizeEmojiAddRequestFields}）
 * - 承認時に emoji テーブルへ入れる値の組み立て（{@link buildEmojiRowFromRequest}）
 * - 経緯の追記、通知の本文に使う「変わった項目」の文
 *
 * @internal
 */
import { toStoredCopyPermission } from "@/misc/copy-permission.js";
import { parseRelatedLinks } from "@/misc/emoji-fedibird.js";
import type {
	EmojiAddRequest,
	EmojiAddRequestEditableFields,
	EmojiAddRequestHistoryEntry,
	EmojiAddRequestProposal,
} from "@/models/entities/emoji-add-request.js";
import type { Emoji } from "@/models/entities/emoji.js";

// #region 定数

/** 絵文字名に使える文字（フォームの説明と同じ：小文字の a-z・0-9・_） */
export const EMOJI_NAME_PATTERN = /^[a-z0-9_]+$/;

/** 「許可の後、コピー可」のとき、使用情報の先頭に付ける文（Google フォームの GAS と同じ） */
export const ASK_BEFORE_COPY_PREFIX = "コピー前に次のユーザの許可を得る事 : ";

/** 文字だけの絵文字のときに固定で入れるライセンス名 */
const TEXT_ONLY_LICENSE_NAME = "CC0 1.0 Universal";

/** 修正案・直して承認で直せる項目の一覧（比較と取り出しに使う） */
export const EMOJI_ADD_REQUEST_EDITABLE_KEYS: ReadonlyArray<keyof EmojiAddRequestEditableFields> = [
	"name",
	"alternateName",
	"ruby",
	"description",
	"category",
	"aliases",
	"sensitive",
	"isTextOnly",
	"motifSelf",
	"motifUserMode",
	"copyPermission",
	"askContact",
	"licenseName",
	"creator",
	"usageInfo",
	"copyrightNotice",
	"creditText",
	"relatedLinks",
	"fileId",
];

// #endregion

// #region 入力の定義と検査

/**
 * 申請の入力項目の paramDef。create・resubmit・request-changes・approve で混ぜ込んで使う。
 *
 * @remarks
 * どれも省略可にしてあり、必須かどうかは {@link normalizeEmojiAddRequestFields} で判断する
 * （修正案では変えた項目だけを送るため）。
 */
export const emojiAddRequestFieldsParamDef = {
	name: { type: "string", minLength: 1, maxLength: 128 },
	alternateName: { type: "string", nullable: true, maxLength: 512 },
	ruby: { type: "string", nullable: true, maxLength: 512 },
	description: { type: "string", nullable: true, maxLength: 4096 },
	category: { type: "string", nullable: true, maxLength: 128 },
	aliases: {
		type: "array",
		maxItems: 64,
		items: { type: "string", minLength: 1, maxLength: 128 },
	},
	sensitive: { type: "boolean" },
	isTextOnly: { type: "boolean" },
	motifSelf: { type: "boolean", nullable: true },
	motifUserMode: { type: "string", nullable: true, enum: ["any", "follow", "owner"] },
	copyPermission: { type: "string", enum: ["allow", "deny", "conditional", "none"] },
	askContact: { type: "string", nullable: true, maxLength: 256 },
	licenseName: { type: "string", nullable: true, maxLength: 256 },
	creator: { type: "string", nullable: true, maxLength: 256 },
	usageInfo: { type: "string", nullable: true, maxLength: 4096 },
	copyrightNotice: { type: "string", nullable: true, maxLength: 4096 },
	creditText: { type: "string", nullable: true, maxLength: 4096 },
	relatedLinks: {
		type: "array",
		maxItems: 20,
		items: { type: "string", maxLength: 512 },
	},
	fileId: { type: "string", format: "misskey:id" },
} as const;

/** 検査で見つかった問題の種類。API 側でエラーに変える */
export type EmojiAddRequestFieldProblem =
	| "invalidName"
	| "motifRequired"
	| "usageInfoRequired";

/**
 * 空白だけの文字列を null にそろえる。
 *
 * @param v - 入力
 * @returns 前後の空白を除いた文字列、または null
 */
function toNullableText(v: string | null | undefined): string | null {
	if (v == null) return null;
	const t = v.trim();
	return t === "" ? null : t;
}

/**
 * 入力値をそろえる（空白の除去、タグの分割、関連リンクの整理、文字だけの絵文字のときの項目の片付け）。
 *
 * @remarks
 * 部分的な入力（修正案）にも使えるよう、省略された項目は結果に含めない。
 *
 * @param ps - API のパラメータ（項目の一部だけでもよい）
 * @returns そろえた値
 * @internal
 */
export function normalizeEmojiAddRequestFields(
	ps: Partial<Record<keyof EmojiAddRequestEditableFields, unknown>>,
): Partial<EmojiAddRequestEditableFields> {
	const out: Partial<EmojiAddRequestEditableFields> = {};
	if (typeof ps.name === "string") out.name = ps.name.trim().toLowerCase();
	if (ps.alternateName !== undefined) out.alternateName = toNullableText(ps.alternateName as string | null);
	if (ps.ruby !== undefined) out.ruby = toNullableText(ps.ruby as string | null);
	if (ps.description !== undefined) out.description = toNullableText(ps.description as string | null);
	if (ps.category !== undefined) out.category = toNullableText(ps.category as string | null);
	if (Array.isArray(ps.aliases)) {
		// 空白区切りでまとめて入れられても 1 つずつに分ける（重複は除く）
		out.aliases = [
			...new Set(
				(ps.aliases as string[])
					.flatMap((x) => x.split(/[\s　]+/))
					.map((x) => x.trim())
					.filter(Boolean),
			),
		];
	}
	if (typeof ps.sensitive === "boolean") out.sensitive = ps.sensitive;
	if (typeof ps.isTextOnly === "boolean") out.isTextOnly = ps.isTextOnly;
	if (ps.motifSelf !== undefined) out.motifSelf = ps.motifSelf as boolean | null;
	if (ps.motifUserMode !== undefined) out.motifUserMode = ps.motifUserMode as EmojiAddRequestEditableFields["motifUserMode"];
	if (typeof ps.copyPermission === "string") out.copyPermission = ps.copyPermission as EmojiAddRequestEditableFields["copyPermission"];
	if (ps.askContact !== undefined) out.askContact = toNullableText(ps.askContact as string | null);
	if (ps.licenseName !== undefined) out.licenseName = toNullableText(ps.licenseName as string | null);
	if (ps.creator !== undefined) out.creator = toNullableText(ps.creator as string | null);
	if (ps.usageInfo !== undefined) out.usageInfo = toNullableText(ps.usageInfo as string | null);
	if (ps.copyrightNotice !== undefined) out.copyrightNotice = toNullableText(ps.copyrightNotice as string | null);
	if (ps.creditText !== undefined) out.creditText = toNullableText(ps.creditText as string | null);
	if (ps.relatedLinks !== undefined) out.relatedLinks = parseRelatedLinks(ps.relatedLinks ?? []);
	if (typeof ps.fileId === "string") out.fileId = ps.fileId;
	return out;
}

/**
 * 申請として成り立っているかを調べる（全項目がそろった値に対して使う）。
 *
 * @remarks
 * - 絵文字名は a-z・0-9・_ だけ
 * - 文字だけの絵文字でなければ、「自分がモチーフか」は必須（K4）
 * - 連絡先があるなら「許可の後、コピー可」なのでコピー可否は conditional に直す（呼び出し側で {@link applyAskContactRule} を先に通す）
 * - conditional で連絡先が無いときは、使用情報が必須（フォームと同じ）
 *
 * @param v - 全項目がそろった値
 * @returns 見つかった問題（無ければ null）
 * @internal
 */
export function findEmojiAddRequestProblem(
	v: EmojiAddRequestEditableFields,
): EmojiAddRequestFieldProblem | null {
	if (!EMOJI_NAME_PATTERN.test(v.name) || v.name.length > 128) return "invalidName";
	if (!v.isTextOnly && v.motifSelf == null) return "motifRequired";
	if (!v.isTextOnly && v.copyPermission === "conditional" && v.askContact == null && v.usageInfo == null) {
		return "usageInfoRequired";
	}
	return null;
}

/**
 * 連絡先と文字だけの絵文字の決まりを当てはめる。
 *
 * @remarks
 * - 連絡先（askContact）があれば「許可の後、コピー可」なので copyPermission を conditional にする
 * - 文字だけの絵文字は、モチーフと連絡先を持たない（ライセンスは承認時に固定値になる）
 * - モチーフが「いいえ」なら利用範囲は持たない
 *
 * @param v - 全項目がそろった値
 * @returns 当てはめた値
 * @internal
 */
export function applyAskContactRule(
	v: EmojiAddRequestEditableFields,
): EmojiAddRequestEditableFields {
	const out = { ...v };
	if (out.isTextOnly) {
		out.motifSelf = null;
		out.motifUserMode = null;
		out.askContact = null;
	}
	if (out.askContact != null) out.copyPermission = "conditional";
	if (out.motifSelf !== true) out.motifUserMode = null;
	else if (out.motifUserMode == null) out.motifUserMode = "any";
	return out;
}

/**
 * 申請の行から、直せる項目だけを取り出す。
 *
 * @param r - 申請
 * @returns 直せる項目の値
 * @internal
 */
export function pickEditableFields(r: EmojiAddRequest): EmojiAddRequestEditableFields {
	return {
		name: r.name,
		alternateName: r.alternateName,
		ruby: r.ruby,
		description: r.description,
		category: r.category,
		aliases: r.aliases ?? [],
		sensitive: r.sensitive,
		isTextOnly: r.isTextOnly,
		motifSelf: r.motifSelf,
		motifUserMode: r.motifUserMode,
		copyPermission: r.copyPermission,
		askContact: r.askContact,
		licenseName: r.licenseName,
		creator: r.creator,
		usageInfo: r.usageInfo,
		copyrightNotice: r.copyrightNotice,
		creditText: r.creditText,
		relatedLinks: r.relatedLinks ?? [],
		fileId: r.fileId ?? "",
	};
}

/**
 * 変更前と変更後を比べて、変わった項目だけを返す。
 *
 * @param before - 変更前
 * @param after - 変更後
 * @returns 変わった項目（無ければ空のオブジェクト）
 * @internal
 */
export function diffEditableFields(
	before: EmojiAddRequestEditableFields,
	after: EmojiAddRequestEditableFields,
): EmojiAddRequestProposal {
	const out: Record<string, unknown> = {};
	for (const key of EMOJI_ADD_REQUEST_EDITABLE_KEYS) {
		const a = before[key];
		const b = after[key];
		const same = Array.isArray(a) && Array.isArray(b) ? a.join("\n") === b.join("\n") : a === b;
		if (!same) out[key] = b;
	}
	return out as EmojiAddRequestProposal;
}

// #endregion

// #region 承認

/**
 * 承認時に emoji テーブルへ入れる値を組み立てる。
 *
 * @remarks
 * - 公開範囲は申請者が選べないので、常に public（K1）
 * - 文字だけの絵文字は、コピー可否・ライセンス・作者を固定値にする（管理画面の追加と同じ）
 * - 「許可の後、コピー可」は、使用情報の先頭に「コピー前に次のユーザの許可を得る事 : {連絡先}」を付け、
 *   申請者の使用情報があれば次の行につなげる（B5。もこチキ＋一声のときに 2 行になる）
 * - 自分がモチーフなら、申請者をモチーフユーザーにする
 *
 * @param r - 申請（承認直前の値）
 * @param file - 絵文字にする画像
 * @returns emoji に入れる値（id・作成日時などは呼び出し側で足す）
 * @internal
 */
export function buildEmojiRowFromRequest(
	r: EmojiAddRequest,
	file: { url: string; webpublicUrl: string | null; type: string; webpublicType: string | null },
): Partial<Emoji> {
	const usageInfo =
		!r.isTextOnly && r.askContact != null
			? [`${ASK_BEFORE_COPY_PREFIX}${r.askContact}`, r.usageInfo].filter(Boolean).join("\n")
			: r.usageInfo;
	return {
		name: r.name,
		host: null,
		category: r.category,
		aliases: r.aliases ?? [],
		originalUrl: file.url,
		publicUrl: file.webpublicUrl ?? file.url,
		type: file.webpublicType ?? file.type,
		alternateName: r.alternateName,
		ruby: r.ruby,
		description: r.description,
		relatedLinks: r.relatedLinks ?? [],
		copyrightNotice: r.copyrightNotice,
		creditText: r.creditText,
		isTextOnly: r.isTextOnly,
		sensitive: r.sensitive,
		copyPermission: toStoredCopyPermission(r.isTextOnly ? "allow" : r.copyPermission),
		licenseName: r.isTextOnly ? TEXT_ONLY_LICENSE_NAME : r.licenseName,
		creator: r.isTextOnly ? null : r.creator,
		usageInfo,
		license: null,
		isBasedOnUrl: null,
		usageVisibility: "public",
		allowedUserIds: [],
		motifUserId: r.motifSelf && r.requesterId ? r.requesterId : null,
		motifUserMode: r.motifSelf ? (r.motifUserMode ?? "any") : "any",
	};
}

// #endregion

// #region 経緯

/**
 * 経緯に 1 件足した配列を返す（元の配列は変えない）。
 *
 * @param history - 今までの経緯
 * @param entry - 足す 1 件（日時は今）
 * @returns 新しい配列
 * @internal
 */
export function appendHistory(
	history: EmojiAddRequestHistoryEntry[] | null | undefined,
	entry: Omit<EmojiAddRequestHistoryEntry, "at">,
): EmojiAddRequestHistoryEntry[] {
	return [...(history ?? []), { at: new Date().toISOString(), ...entry }];
}

// #endregion

// #region 通知の文

/** 通知の本文に入れる、変わった項目の表示名 */
const FIELD_LABELS: Readonly<Record<keyof EmojiAddRequestEditableFields, string>> = {
	name: "絵文字名",
	alternateName: "表示名",
	ruby: "読み",
	description: "説明",
	category: "カテゴリ",
	aliases: "タグ",
	sensitive: "センシティブ",
	isTextOnly: "文字だけの絵文字",
	motifSelf: "モチーフ",
	motifUserMode: "使える人",
	copyPermission: "コピー可否",
	askContact: "許可を取る連絡先",
	licenseName: "ライセンス",
	creator: "作者",
	usageInfo: "使用情報",
	copyrightNotice: "著作権の表示",
	creditText: "クレジット",
	relatedLinks: "関連リンク",
	fileId: "画像",
};

/**
 * 変わった項目の名前を「、」でつないだ文を返す（通知の本文用）。
 *
 * @param changes - 変わった項目
 * @returns 例「絵文字名、カテゴリ」。無ければ空文字
 * @internal
 */
export function describeChangedFields(changes: EmojiAddRequestProposal): string {
	return (Object.keys(changes) as Array<keyof EmojiAddRequestEditableFields>)
		.map((k) => FIELD_LABELS[k])
		.filter(Boolean)
		.join("、");
}

// #endregion
