/**
 * @packageDocumentation
 *
 * 絵文字申請（追加申請・インポート申請）の画面で共通に使う、型・表示名・値の書き方。
 *
 * @remarks
 * 一覧ページ・詳細ページ・申請ページ（再申請）・審査画面で同じ表示にするために置いている。
 * - 項目名はサーバー側の FIELD_LABELS（`packages/backend/src/misc/emoji-add-request-fields.ts`）と合わせる。
 *   項目を増やしたら両方を直す
 * - コピー可否は DB 上の 4 値だけを持つ。conditional で連絡先があれば「許可の後、コピー可」と表示する
 *
 * @internal
 */
import {
	COPY_PERMISSION_ASK,
	EMOJI_COPY_PERMISSION_REQUEST_OPTIONS,
	EMOJI_LICENSE_OTHER,
	resolveLicenseSelectValue,
} from "@/scripts/emoji-license";

// #region 型

/** 追加申請の状態 */
export type EmojiAddRequestStatus = "pending" | "changesRequested" | "approved" | "rejected" | "withdrawn";

/** 修正案・直して承認で直せる項目 */
export type EmojiAddRequestFields = {
	name: string;
	alternateName: string | null;
	ruby: string | null;
	description: string | null;
	category: string | null;
	aliases: string[];
	sensitive: boolean;
	isTextOnly: boolean;
	motifSelf: boolean | null;
	motifUserMode: "any" | "follow" | "owner" | null;
	copyPermission: "allow" | "deny" | "conditional" | "none";
	askContact: string | null;
	licenseName: string | null;
	creator: string | null;
	usageInfo: string | null;
	copyrightNotice: string | null;
	creditText: string | null;
	relatedLinks: string[];
	fileId: string | null;
};

/** 経緯の 1 件 */
export type EmojiAddRequestHistoryEntry = {
	at: string;
	by: string | null;
	action: "created" | "changesRequested" | "resubmitted" | "approved" | "approvedWithChanges" | "rejected" | "withdrawn";
	comment?: string | null;
	changes?: Partial<EmojiAddRequestFields>;
};

/** API（emoji-add-request/show・my-list・list）が返す追加申請 */
export type PackedEmojiAddRequest = EmojiAddRequestFields & {
	id: string;
	createdAt: string;
	updatedAt: string;
	status: EmojiAddRequestStatus;
	source: "form" | "megamoji" | "legacy";
	requesterId: string | null;
	requester: { id: string; username: string; host: string | null } | null;
	file: { id: string; url: string; type: string; width: number | null; height: number | null; size: number } | null;
	imageProcessed: boolean;
	originalWidth: number | null;
	originalHeight: number | null;
	message: string | null;
	proposal: Partial<EmojiAddRequestFields> | null;
	proposalFileUrl: string | null;
	reviewComment: string | null;
	processedAt: string | null;
	approvedEmojiId: string | null;
	history: EmojiAddRequestHistoryEntry[];
};

/** API（emoji-import-request/my-list）が返すインポート申請 */
export type PackedEmojiImportRequest = {
	id: string;
	emojiName: string;
	emojiHost: string;
	status: "pending" | "approved" | "rejected";
	reason?: string | null;
	importedEmojiId?: string | null;
	processedAt?: string | null;
	createdAt: string;
};

// #endregion

// #region 表示名

/** 状態の札の色（一覧・詳細のスタイルで使う） */
export type EmojiRequestStatusTone = "info" | "warn" | "success" | "error" | "dim";

/** 状態の表示名と札の色（インポート申請も同じ名前を使う） */
export const EMOJI_REQUEST_STATUS: Readonly<Record<string, { label: string; tone: EmojiRequestStatusTone }>> = {
	pending: { label: "審査待ち", tone: "info" },
	changesRequested: { label: "修正のお願い", tone: "warn" },
	approved: { label: "追加済み", tone: "success" },
	rejected: { label: "見送り", tone: "error" },
	withdrawn: { label: "取り下げ", tone: "dim" },
};

/** 項目名（サーバー側の FIELD_LABELS と同じ） */
export const EMOJI_ADD_REQUEST_FIELD_LABELS: Readonly<Record<keyof EmojiAddRequestFields, string>> = {
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

/** 表示する順（申請画面の並びと同じ） */
export const EMOJI_ADD_REQUEST_FIELD_ORDER: ReadonlyArray<keyof EmojiAddRequestFields> = [
	"fileId",
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
	"licenseName",
	"creator",
	"askContact",
	"usageInfo",
	"copyrightNotice",
	"creditText",
	"relatedLinks",
];

/** モチーフが自分のときの、使える人の表示名 */
export const MOTIF_USER_MODE_LABELS: Readonly<Record<string, string>> = {
	any: "誰でも使える",
	follow: "フォロー限定",
	owner: "自分限定",
};

/** 経緯の操作の表示名 */
export const HISTORY_ACTION_LABELS: Readonly<Record<EmojiAddRequestHistoryEntry["action"], string>> = {
	created: "申請",
	changesRequested: "修正のお願い",
	resubmitted: "再申請",
	approved: "承認",
	approvedWithChanges: "一部を直して承認",
	rejected: "見送り",
	withdrawn: "取り下げ",
};

// #endregion

// #region 値の書き方

/**
 * 項目の値を、画面に出す文にする。
 *
 * @param key - 項目
 * @param value - 値
 * @param whole - 同じ申請の他の項目（コピー可否を「許可の後」と出すかどうかに使う）
 * @returns 表示する文（空なら空文字）
 * @internal
 */
export function formatEmojiAddRequestField(
	key: keyof EmojiAddRequestFields,
	value: unknown,
	whole?: Partial<EmojiAddRequestFields>,
): string {
	if (value == null) return "";
	switch (key) {
		case "name":
			return `:${value}:`;
		case "aliases":
			return (value as string[]).join("、");
		case "relatedLinks":
			return (value as string[]).join("\n");
		case "sensitive":
		case "isTextOnly":
			return value ? "はい" : "いいえ";
		case "motifSelf":
			return value ? "自分がモチーフ" : "自分はモチーフではない";
		case "motifUserMode":
			return MOTIF_USER_MODE_LABELS[value as string] ?? String(value);
		case "copyPermission":
			if (value === "conditional" && whole?.askContact) return "許可の後、コピー可";
			return EMOJI_COPY_PERMISSION_REQUEST_OPTIONS.find((o) => o.value === value)?.label ?? String(value);
		case "fileId":
			return "画像";
		default:
			return String(value);
	}
}

/**
 * コピー可否を、画面の選択肢の値にする（conditional で連絡先があれば「許可の後、コピー可」）。
 *
 * @param v - コピー可否と連絡先
 * @returns 画面の選択肢の値（"allow" / "deny" / "conditional" / "none" / "ask"）
 * @internal
 */
export function toCopyPermissionChoice(v: Partial<Pick<EmojiAddRequestFields, "copyPermission" | "askContact">>): string {
	return v.copyPermission === "conditional" && v.askContact ? COPY_PERMISSION_ASK : v.copyPermission ?? "none";
}

// #endregion

// #region 入力欄との変換（審査画面の修正案の入力）

/**
 * 審査画面の入力欄の値。申請の項目を、入力欄で扱いやすい形（文字列・画面の選択肢）にしたもの。
 *
 * @remarks
 * コピー可否は画面の選択肢（"ask" を含む）、ライセンスは選択欄の値と「その他」の自由入力に分ける。
 */
export type EmojiAddRequestForm = {
	name: string;
	alternateName: string;
	ruby: string;
	description: string;
	category: string;
	/** 空白区切り */
	aliases: string;
	sensitive: boolean;
	isTextOnly: boolean;
	/** "" は未回答 */
	motifSelf: "" | "yes" | "no";
	motifUserMode: "any" | "follow" | "owner";
	copyPermission: string;
	askContact: string;
	licenseSelect: string;
	licenseOther: string;
	creator: string;
	usageInfo: string;
	copyrightNotice: string;
	creditText: string;
	/** 1 行に 1 つ */
	relatedLinks: string;
};

/**
 * 申請の項目を、入力欄の値にする。
 *
 * @param r - 申請の項目
 * @returns 入力欄の値
 * @internal
 */
export function requestFieldsToForm(r: EmojiAddRequestFields): EmojiAddRequestForm {
	const licenseSelect = resolveLicenseSelectValue(r.licenseName);
	return {
		name: r.name,
		alternateName: r.alternateName ?? "",
		ruby: r.ruby ?? "",
		description: r.description ?? "",
		category: r.category ?? "",
		aliases: (r.aliases ?? []).join(" "),
		sensitive: r.sensitive,
		isTextOnly: r.isTextOnly,
		motifSelf: r.motifSelf == null ? "" : r.motifSelf ? "yes" : "no",
		motifUserMode: r.motifUserMode ?? "any",
		copyPermission: toCopyPermissionChoice(r),
		askContact: r.askContact ?? "",
		licenseSelect,
		licenseOther: licenseSelect === EMOJI_LICENSE_OTHER ? r.licenseName ?? "" : "",
		creator: r.creator ?? "",
		usageInfo: r.usageInfo ?? "",
		copyrightNotice: r.copyrightNotice ?? "",
		creditText: r.creditText ?? "",
		relatedLinks: (r.relatedLinks ?? []).join("\n"),
	};
}

/**
 * 入力欄の値を、申請の項目にする（サーバー側の正規化と同じ書き方にそろえる）。
 *
 * @remarks
 * 空白だけの文字は null、絵文字名は小文字、タグは空白で分けて重複を除き、関連リンクは空行を除く。
 * 「許可の後、コピー可」は conditional と連絡先にする。それ以外のときは連絡先を持たない。
 *
 * @param f - 入力欄の値
 * @param fileId - 画像
 * @returns 申請の項目
 * @internal
 */
export function formToRequestFields(f: EmojiAddRequestForm, fileId: string | null): EmojiAddRequestFields {
	const text = (v: string) => v.trim() || null;
	const ask = f.copyPermission === COPY_PERMISSION_ASK;
	const motifSelf = f.motifSelf === "" ? null : f.motifSelf === "yes";
	return {
		name: f.name.trim().toLowerCase(),
		alternateName: text(f.alternateName),
		ruby: text(f.ruby),
		description: text(f.description),
		category: text(f.category),
		aliases: [...new Set(f.aliases.split(/[\s　]+/).filter(Boolean))],
		sensitive: f.sensitive,
		isTextOnly: f.isTextOnly,
		motifSelf,
		motifUserMode: motifSelf ? f.motifUserMode : null,
		copyPermission: (ask ? "conditional" : f.copyPermission) as EmojiAddRequestFields["copyPermission"],
		askContact: ask ? text(f.askContact) : null,
		licenseName: f.licenseSelect === EMOJI_LICENSE_OTHER ? text(f.licenseOther) : f.licenseSelect || null,
		creator: text(f.creator),
		usageInfo: text(f.usageInfo),
		copyrightNotice: text(f.copyrightNotice),
		creditText: text(f.creditText),
		relatedLinks: f.relatedLinks.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
		fileId,
	};
}

/**
 * 2 つの申請の項目を比べ、変わった項目だけを返す。
 *
 * @param before - 元の値
 * @param after - 新しい値
 * @returns 変わった項目（新しい値）
 * @internal
 */
export function diffRequestFields(
	before: EmojiAddRequestFields,
	after: EmojiAddRequestFields,
): Partial<EmojiAddRequestFields> {
	const out: Partial<EmojiAddRequestFields> = {};
	for (const k of EMOJI_ADD_REQUEST_FIELD_ORDER) {
		if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) {
			(out as Record<string, unknown>)[k] = after[k];
		}
	}
	return out;
}

/**
 * 申請の項目だけを取り出す（API の返り値には他の情報も入っているため）。
 *
 * @param r - API の返り値
 * @returns 申請の項目
 * @internal
 */
export function pickRequestFields(r: PackedEmojiAddRequest): EmojiAddRequestFields {
	const out = {} as Record<string, unknown>;
	for (const k of EMOJI_ADD_REQUEST_FIELD_ORDER) out[k] = r[k];
	return out as EmojiAddRequestFields;
}

// #endregion

// #region 日時

/**
 * 日時を「2026/09/25 12:34」の形にする。
 *
 * @param s - ISO 8601 の日時
 * @returns 表示する文（空なら空文字）
 * @internal
 */
export function formatRequestDate(s: string | null | undefined): string {
	if (!s) return "";
	const d = new Date(s);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// #endregion
