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
import { EMOJI_COPY_PERMISSION_REQUEST_OPTIONS } from "@/scripts/emoji-license";

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
