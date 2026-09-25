/**
 * @packageDocumentation
 *
 * Fedibird 互換の絵文字情報（alternateName / ruby / relatedLinks / copyrightNotice / creditText など）の
 * 受け取り・送り出しに使う変換処理をまとめたモジュール。
 *
 * @remarks
 * - 受け取り（{@link extractFedibirdEmojiFields}）は ActivityPub の Emoji タグから、Fedibird 形式で届いた項目だけを取り出す。
 *   `_misskey_license.freeText` は書き方が信用できないので、中身は読み取らず参考情報としてそのまま返す。
 * - 送り出し（{@link buildMisskeyLicenseFreeText}）は、上流 Misskey 向けの 1 行まとめを Fedibird の `format_summary` と同じ書き方で作る。
 * - DB やネットワークには触れない純粋な関数だけを置く（単体テストしやすくするため）。
 *
 * @see https://github.com/fedibird/mastodon/blob/fedibird/app/models/custom_emoji.rb
 * @see https://github.com/fedibird/mastodon/blob/fedibird/app/lib/formatter.rb
 * @internal
 */

// #region 定数

/** alternateName / ruby の最大文字数（DB 列の長さに合わせる） */
const MAX_SHORT_TEXT_LENGTH = 512;

/** 関連リンク 1 件の最大文字数（DB 列の長さに合わせる） */
const MAX_RELATED_LINK_LENGTH = 512;

/** 関連リンクとして保存する最大件数。異常に大きい配列を送られても DB を圧迫しないようにする */
const MAX_RELATED_LINKS = 20;

/** 著作権表示・クレジット・参考情報の最大文字数。text 列だが、極端に長い値は切り詰める */
const MAX_LONG_TEXT_LENGTH = 4096;

/** カテゴリ列の最大文字数（DB 列の長さに合わせる） */
const MAX_CATEGORY_LENGTH = 128;

/**
 * ライセンスの URL（正規化済み）から、もこきーで使うライセンス名への対応表。
 *
 * @remarks
 * Fedibird の `COMMON_LICENSES` と同じ範囲。名前はもこきーの選択肢の書き方に合わせる
 * （Fedibird は CC0 を `CC0`、パブリックドメイン・マークを `PD` と呼ぶが、もこきーでは別の書き方をしている）。
 * キーは {@link normalizeLicenseUrlKey} で正規化した形（スキーム・`www.`・末尾の `/` を外し、小文字にしたもの）。
 */
const LICENSE_URL_TO_NAME: Readonly<Record<string, string>> = (() => {
	const table: Record<string, string> = {
		"creativecommons.org/publicdomain/zero/1.0": "CC0 1.0 Universal",
		"creativecommons.org/publicdomain/mark/1.0": "Public Domain",
		"apache.org/licenses/license-2.0": "Apache-2.0",
	};
	// CC の各種（4.0 / 3.0）は規則的なので組み立てる
	const kinds: Array<[string, string]> = [
		["by", "CC BY"],
		["by-sa", "CC BY-SA"],
		["by-nc", "CC BY-NC"],
		["by-nc-sa", "CC BY-NC-SA"],
		["by-nd", "CC BY-ND"],
		["by-nc-nd", "CC BY-NC-ND"],
	];
	for (const version of ["4.0", "3.0"]) {
		for (const [path, name] of kinds) {
			table[`creativecommons.org/licenses/${path}/${version}`] = `${name} ${version}`;
		}
	}
	return table;
})();

/** コピー可否（完全形）のうち、1 行まとめに `#値` として書くもの。none は書かない（Fedibird と同じ） */
const SUMMARY_COPY_PERMISSIONS = new Set(["allow", "deny", "conditional"]);

// #endregion

// #region 型

/**
 * ActivityPub の Emoji タグから取り出した Fedibird 形式の項目。
 *
 * @remarks
 * 値が届かなかった項目は null（relatedLinks は空配列）。
 *
 * @internal
 */
export interface FedibirdEmojiFields {
	alternateName: string | null;
	ruby: string | null;
	relatedLinks: string[];
	copyrightNotice: string | null;
	creditText: string | null;
	/** 元の絵文字の URL（`isBasedOn`）。`isBasedOnUrl` が無いときの予備 */
	isBasedOn: string | null;
	/** ActivityPub で届いたカテゴリ（ホスト名を付ける前の生の値） */
	category: string | null;
	/** `_misskey_license.freeText` をそのまま残した参考情報 */
	sourceLicenseText: string | null;
}

/**
 * 1 行まとめを作るのに使う絵文字の項目。
 *
 * @remarks
 * copyPermission は完全形（allow / deny / conditional / none）で渡す。
 *
 * @internal
 */
export interface MisskeyLicenseSummarySource {
	alternateName: string | null;
	ruby: string | null;
	creator: string | null;
	copyrightNotice: string | null;
	creditText: string | null;
	licenseName: string | null;
	usageInfo: string | null;
	relatedLinks: string[];
	copyPermission: string | null;
	description: string | null;
}

// #endregion

// #region 受け取り

/**
 * 文字列として扱える値だけを、前後の空白を除いて返す。
 *
 * @param value - タグの値（型は信用しない）
 * @param maxLength - これより長ければ切り詰める
 * @returns 空でない文字列、または null
 */
function toTrimmedString(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed === "") return null;
	return trimmed.slice(0, maxLength);
}

/**
 * 関連リンクを配列にそろえる。
 *
 * @remarks
 * Fedibird は配列で送るが、文字列 1 つ（空白・改行区切り）で来ることもあるので両方受け付ける
 * （Fedibird の `related_links=` と同じ扱い）。
 *
 * @param value - `relatedLinks` または `relatedLink` の値
 * @returns 空要素を除いた配列（最大 {@link MAX_RELATED_LINKS} 件）
 * @internal
 */
export function parseRelatedLinks(value: unknown): string[] {
	const items: unknown[] = Array.isArray(value)
		? value
		: typeof value === "string"
			? value.split(/[\s　]+/)
			: [];
	return items
		.map((x) => toTrimmedString(x, MAX_RELATED_LINK_LENGTH))
		.filter((x): x is string => x != null)
		.slice(0, MAX_RELATED_LINKS);
}

/**
 * URL を対応表のキーの形にそろえる。
 *
 * @param url - ライセンスの URL
 * @returns スキーム・`www.`・末尾の `/`・`legalcode` や `deed.ja` を外して小文字にしたもの
 */
function normalizeLicenseUrlKey(url: string): string {
	return url
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.replace(/\/(legalcode|deed)(\.[a-z-]+)?$/, "")
		.replace(/\/+$/, "");
}

/**
 * 受け取ったライセンスの値を、もこきーのライセンス名にそろえる。
 *
 * @remarks
 * Fedibird は `license` に URL を入れて送ってくる。対応表にある URL は名前に直し、
 * それ以外（名前や未知の URL）は受け取った文字列をそのまま返す。URL は必須ではない（Fedibird も自由な文字列として扱っている）。
 *
 * @param value - タグの `license`
 * @returns ライセンス名、または null
 * @internal
 */
export function normalizeLicenseName(value: unknown): string | null {
	const text = toTrimmedString(value, MAX_LONG_TEXT_LENGTH);
	if (text == null) return null;
	if (!/^https?:\/\//i.test(text)) return text;
	return LICENSE_URL_TO_NAME[normalizeLicenseUrlKey(text)] ?? text;
}

/**
 * `_misskey_license` とその別名から freeText を取り出す。
 *
 * @param tag - Emoji タグ
 * @returns freeText の文字列、または null
 */
function pickMisskeyLicenseFreeText(tag: Record<string, unknown>): string | null {
	for (const key of ["_misskey_license", "misskeyLicense", "_misskeyLicense"]) {
		const holder = tag[key];
		if (holder != null && typeof holder === "object") {
			const text = toTrimmedString(
				(holder as { freeText?: unknown }).freeText,
				MAX_LONG_TEXT_LENGTH,
			);
			if (text != null) return text;
		}
	}
	return null;
}

/**
 * ActivityPub の Emoji タグから、Fedibird 形式の項目を取り出す。
 *
 * @remarks
 * 取り出すのは Fedibird 形式の個別の項目だけ。`_misskey_license.freeText` の中身は読み取らず、
 * `sourceLicenseText` にそのまま入れる（書き方がサーバーごとにばらばらで信用できないため）。
 * キーの別名（`relatedLink` / `isBasedOn` / `misskeyLicense` など）も Fedibird と同じく受け付ける。
 *
 * @param tag - ActivityPub の Emoji タグ（型は信用しない）
 * @returns 取り出した項目
 * @internal
 */
export function extractFedibirdEmojiFields(tag: object): FedibirdEmojiFields {
	const t = tag as Record<string, unknown>;
	return {
		alternateName: toTrimmedString(t.alternateName, MAX_SHORT_TEXT_LENGTH),
		ruby: toTrimmedString(t.ruby, MAX_SHORT_TEXT_LENGTH),
		// Fedibird の実データは relatedLinks、@context 上の名前は relatedLink
		relatedLinks: parseRelatedLinks(t.relatedLinks ?? t.relatedLink),
		copyrightNotice: toTrimmedString(t.copyrightNotice, MAX_LONG_TEXT_LENGTH),
		creditText: toTrimmedString(t.creditText, MAX_LONG_TEXT_LENGTH),
		isBasedOn: toTrimmedString(t.isBasedOn, MAX_RELATED_LINK_LENGTH),
		category: toTrimmedString(t.category, MAX_CATEGORY_LENGTH),
		sourceLicenseText: pickMisskeyLicenseFreeText(t),
	};
}

/** Fedibird 形式の項目のうち、emoji テーブルにそのまま保存する列 */
export type FedibirdEmojiColumns = Pick<
	FedibirdEmojiFields,
	| "alternateName"
	| "ruby"
	| "relatedLinks"
	| "copyrightNotice"
	| "creditText"
	| "sourceLicenseText"
>;

/**
 * 取り出した項目を、emoji テーブルの列の形にする。
 *
 * @remarks
 * isBasedOn と category は別の列（isBasedOnUrl / category）に入るので含めない。
 *
 * @param fields - {@link extractFedibirdEmojiFields} の結果
 * @returns 保存する列と値
 * @internal
 */
export function toFedibirdColumns(fields: FedibirdEmojiFields): FedibirdEmojiColumns {
	return {
		alternateName: fields.alternateName,
		ruby: fields.ruby,
		relatedLinks: fields.relatedLinks,
		copyrightNotice: fields.copyrightNotice,
		creditText: fields.creditText,
		sourceLicenseText: fields.sourceLicenseText,
	};
}

/**
 * 保存済みの絵文字と比べて、Fedibird 形式の項目が変わったかを返す。
 *
 * @param fields - 今回届いた項目
 * @param current - 保存済みの値（古い行では relatedLinks が無いこともある）
 * @returns 1 つでも違えば true
 * @internal
 */
export function isFedibirdFieldsChanged(
	fields: FedibirdEmojiFields,
	current: Partial<FedibirdEmojiColumns>,
): boolean {
	const next = toFedibirdColumns(fields);
	return (
		next.alternateName !== (current.alternateName ?? null) ||
		next.ruby !== (current.ruby ?? null) ||
		next.copyrightNotice !== (current.copyrightNotice ?? null) ||
		next.creditText !== (current.creditText ?? null) ||
		next.sourceLicenseText !== (current.sourceLicenseText ?? null) ||
		next.relatedLinks.join("\n") !== (current.relatedLinks ?? []).join("\n")
	);
}

// #endregion

// #region カテゴリ

/**
 * リモート絵文字のカテゴリを、保存用の「カテゴリ名 <ホスト>」の形にする。
 *
 * @param category - 元のカテゴリ名
 * @param host - 絵文字のホスト
 * @returns 保存用のカテゴリ（列の長さを超える分は切り詰める）。category が空なら null
 * @internal
 */
export function toRemoteCategory(
	category: string | null | undefined,
	host: string,
): string | null {
	if (category == null || category.trim() === "") return null;
	return `${category.trim()} <${host}>`.slice(0, MAX_CATEGORY_LENGTH);
}

/**
 * リモート絵文字の「カテゴリ名 <ホスト>」から、末尾のホスト名を外す。
 *
 * @remarks
 * ローカルにコピーしたときの `orgCategory`（コピー元のカテゴリ）に使う。
 * ホスト名が付いていなければ、そのまま返す。
 *
 * @param category - リモート絵文字の category
 * @param host - リモート絵文字のホスト。分かっていればそのホスト名だけを外す
 * @returns ホスト名を外したカテゴリ、または null
 * @internal
 */
export function stripHostFromCategory(
	category: string | null | undefined,
	host?: string | null,
): string | null {
	if (category == null) return null;
	const suffix = host ? ` <${host}>` : null;
	let stripped = category;
	if (suffix && stripped.endsWith(suffix)) {
		stripped = stripped.slice(0, -suffix.length);
	} else if (!suffix) {
		stripped = stripped.replace(/\s<[^<>\s]+>$/, "");
	}
	stripped = stripped.trim();
	return stripped === "" ? null : stripped;
}

/**
 * リモート絵文字をローカルにコピーするとき、引き継ぐ Fedibird 互換項目を作る。
 *
 * @remarks
 * `admin/emoji/copy` とインポート申請の承認で使う（Fedibird の `CustomEmoji#copy!` と同じく全項目を写す）。
 * コピー元のカテゴリ（orgCategory）は、リモートの「カテゴリ名 <ホスト>」からホスト名を外して入れる。
 * 参考情報の sourceLicenseText も、ライセンスを確かめる手がかりとして引き継ぐ。
 *
 * @param source - コピー元のリモート絵文字
 * @returns コピー先に入れる列と値
 * @internal
 */
export function buildCopiedEmojiExtraFields(source: {
	host: string | null;
	category: string | null;
	alternateName?: string | null;
	ruby?: string | null;
	relatedLinks?: string[] | null;
	copyrightNotice?: string | null;
	creditText?: string | null;
	sourceLicenseText?: string | null;
}): FedibirdEmojiColumns & { orgCategory: string | null } {
	return {
		alternateName: source.alternateName ?? null,
		ruby: source.ruby ?? null,
		relatedLinks: source.relatedLinks ?? [],
		copyrightNotice: source.copyrightNotice ?? null,
		creditText: source.creditText ?? null,
		sourceLicenseText: source.sourceLicenseText ?? null,
		orgCategory: stripHostFromCategory(source.category, source.host),
	};
}

// #endregion

// #region 送り出し

/**
 * 上流 Misskey 向けの `_misskey_license.freeText`（1 行まとめ）を作る。
 *
 * @remarks
 * Fedibird の `Formatter#format_summary` と同じ並び・書き方にする。
 * `name: 表示名, (よみ), creator: …, copyrightNotice: …, creditText: …, license: …, usage: …, links: … …, #allow, description: …`
 * - 空の項目は出さない
 * - コピー可否は allow / deny / conditional のときだけ `#値` で出す
 * - 改行は空白に置き換える
 *
 * @param source - 絵文字の項目
 * @returns 1 行まとめ。書く項目が 1 つも無ければ null
 * @internal
 */
export function buildMisskeyLicenseFreeText(
	source: MisskeyLicenseSummarySource,
): string | null {
	const parts: string[] = [];
	const push = (value: string | null | undefined, format: (v: string) => string) => {
		if (value != null && value.trim() !== "") parts.push(format(value.trim()));
	};
	push(source.alternateName, (v) => `name: ${v}`);
	push(source.ruby, (v) => `(${v})`);
	push(source.creator, (v) => `creator: ${v}`);
	push(source.copyrightNotice, (v) => `copyrightNotice: ${v}`);
	push(source.creditText, (v) => `creditText: ${v}`);
	push(source.licenseName, (v) => `license: ${v}`);
	push(source.usageInfo, (v) => `usage: ${v}`);
	push(source.relatedLinks.join(" "), (v) => `links: ${v}`);
	if (source.copyPermission && SUMMARY_COPY_PERMISSIONS.has(source.copyPermission)) {
		parts.push(`#${source.copyPermission}`);
	}
	push(source.description, (v) => `description: ${v}`);
	if (parts.length === 0) return null;
	return parts.join(", ").replace(/\r\n|\r|\n/g, " ");
}

// #endregion
